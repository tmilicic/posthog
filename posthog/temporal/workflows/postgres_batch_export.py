import contextlib
import datetime as dt
import json
from dataclasses import dataclass

import psycopg2
from django.conf import settings
from psycopg2 import sql
from temporalio import activity, exceptions, workflow
from temporalio.common import RetryPolicy

from posthog.batch_exports.service import PostgresBatchExportInputs
from posthog.temporal.workflows.base import PostHogWorkflow
from posthog.temporal.workflows.batch_exports import (
    BatchExportTemporaryFile,
    CreateBatchExportRunInputs,
    UpdateBatchExportRunStatusInputs,
    create_export_run,
    get_batch_exports_logger,
    get_data_interval,
    get_results_iterator,
    get_rows_count,
    update_export_run_status,
)
from posthog.temporal.workflows.clickhouse import get_client


@contextlib.contextmanager
def postgres_connection(inputs):
    """Manage a Postgres connection."""
    connection = psycopg2.connect(
        user=inputs.user,
        password=inputs.password,
        database=inputs.database,
        host=inputs.host,
        port=inputs.port,
        # The 'hasSelfSignedCert' parameter in the postgres-plugin was provided mainly
        # for users of Heroku and RDS. It was used to set 'rejectUnauthorized' to false if a self-signed cert was used.
        # Mapping this to sslmode is not straight-forward, but going by Heroku's recommendation (see below) we should use 'no-verify'.
        # Reference: https://devcenter.heroku.com/articles/connecting-heroku-postgres#connecting-in-node-js
        sslmode="no-verify" if inputs.has_self_signed_cert is True else "prefer",
    )

    try:
        yield connection
    except Exception:
        connection.rollback()
        raise
    else:
        connection.commit()
    finally:
        connection.close()


def copy_tsv_to_postgres(tsv_file, postgres_connection, schema: str, table_name: str, schema_columns):
    """Execute a COPY FROM query with given connection to copy contents of tsv_file."""
    tsv_file.seek(0)

    with postgres_connection.cursor() as cursor:
        cursor.execute(sql.SQL("SET search_path TO {schema}").format(schema=sql.Identifier(schema)))
        cursor.copy_from(
            tsv_file,
            table_name,
            null="",
            columns=schema_columns,
        )


@dataclass
class PostgresInsertInputs:
    """Inputs for Postgres."""

    team_id: int
    user: str
    password: str
    host: str
    database: str
    table_name: str
    data_interval_start: str
    data_interval_end: str
    has_self_signed_cert: bool = False
    schema: str = "public"
    port: int = 5432
    exclude_events: list[str] | None = None
    include_events: list[str] | None = None


@activity.defn
async def insert_into_postgres_activity(inputs: PostgresInsertInputs):
    """Activity streams data from ClickHouse to Postgres."""
    logger = get_batch_exports_logger(inputs=inputs)
    logger.info(
        "Running Postgres export batch %s - %s",
        inputs.data_interval_start,
        inputs.data_interval_end,
    )

    async with get_client() as client:
        if not await client.is_alive():
            raise ConnectionError("Cannot establish connection to ClickHouse")

        count = await get_rows_count(
            client=client,
            team_id=inputs.team_id,
            interval_start=inputs.data_interval_start,
            interval_end=inputs.data_interval_end,
            exclude_events=inputs.exclude_events,
            include_events=inputs.include_events,
        )

        if count == 0:
            logger.info(
                "Nothing to export in batch %s - %s",
                inputs.data_interval_start,
                inputs.data_interval_end,
            )
            return

        logger.info("BatchExporting %s rows to Postgres", count)

        results_iterator = get_results_iterator(
            client=client,
            team_id=inputs.team_id,
            interval_start=inputs.data_interval_start,
            interval_end=inputs.data_interval_end,
            exclude_events=inputs.exclude_events,
            include_events=inputs.include_events,
        )
        with postgres_connection(inputs) as connection:
            with connection.cursor() as cursor:
                result = cursor.execute(
                    sql.SQL(
                        """
                        CREATE TABLE IF NOT EXISTS {} (
                            "uuid" VARCHAR(200),
                            "event" VARCHAR(200),
                            "properties" JSONB,
                            "elements" JSONB,
                            "set" JSONB,
                            "set_once" JSONB,
                            "distinct_id" VARCHAR(200),
                            "team_id" INTEGER,
                            "ip" VARCHAR(200),
                            "site_url" VARCHAR(200),
                            "timestamp" TIMESTAMP WITH TIME ZONE
                        )
                        """
                    ).format(sql.Identifier(inputs.schema, inputs.table_name))
                )

        schema_columns = [
            "uuid",
            "event",
            "properties",
            "elements",
            "set",
            "set_once",
            "distinct_id",
            "team_id",
            "ip",
            "site_url",
            "timestamp",
        ]
        json_columns = ("properties", "elements", "set", "set_once")

        with BatchExportTemporaryFile() as pg_file:
            with postgres_connection(inputs) as connection:
                for result in results_iterator:
                    row = {
                        key: json.dumps(result[key]) if key in json_columns and result[key] is not None else result[key]
                        for key in schema_columns
                    }
                    pg_file.write_records_to_tsv([row], fieldnames=schema_columns)

                    if pg_file.tell() > settings.BATCH_EXPORT_POSTGRES_UPLOAD_CHUNK_SIZE_BYTES:
                        logger.info(
                            "Copying %s records of size %s bytes to Postgres",
                            pg_file.records_since_last_reset,
                            pg_file.bytes_since_last_reset,
                        )
                        copy_tsv_to_postgres(pg_file, connection, inputs.schema, inputs.table_name, schema_columns)
                        pg_file.reset()

                if pg_file.tell() > 0:
                    logger.info(
                        "Copying %s records of size %s bytes to Postgres",
                        pg_file.records_since_last_reset,
                        pg_file.bytes_since_last_reset,
                    )
                    copy_tsv_to_postgres(pg_file, connection, inputs.schema, inputs.table_name, schema_columns)


@workflow.defn(name="postgres-export")
class PostgresBatchExportWorkflow(PostHogWorkflow):
    """A Temporal Workflow to export ClickHouse data into Postgres.

    This Workflow is intended to be executed both manually and by a Temporal
    Schedule. When ran by a schedule, `data_interval_end` should be set to
    `None` so that we will fetch the end of the interval from the Temporal
    search attribute `TemporalScheduledStartTime`.
    """

    @staticmethod
    def parse_inputs(inputs: list[str]) -> PostgresBatchExportInputs:
        """Parse inputs from the management command CLI."""
        loaded = json.loads(inputs[0])
        return PostgresBatchExportInputs(**loaded)

    @workflow.run
    async def run(self, inputs: PostgresBatchExportInputs):
        """Workflow implementation to export data to Postgres."""
        logger = get_batch_exports_logger(inputs=inputs)
        data_interval_start, data_interval_end = get_data_interval(inputs.interval, inputs.data_interval_end)
        logger.info("Starting Postgres export batch %s - %s", data_interval_start, data_interval_end)

        create_export_run_inputs = CreateBatchExportRunInputs(
            team_id=inputs.team_id,
            batch_export_id=inputs.batch_export_id,
            data_interval_start=data_interval_start.isoformat(),
            data_interval_end=data_interval_end.isoformat(),
        )
        run_id = await workflow.execute_activity(
            create_export_run,
            create_export_run_inputs,
            start_to_close_timeout=dt.timedelta(minutes=5),
            retry_policy=RetryPolicy(
                initial_interval=dt.timedelta(seconds=10),
                maximum_interval=dt.timedelta(seconds=60),
                maximum_attempts=0,
                non_retryable_error_types=["NotNullViolation", "IntegrityError"],
            ),
        )

        update_inputs = UpdateBatchExportRunStatusInputs(id=run_id, status="Completed")

        insert_inputs = PostgresInsertInputs(
            team_id=inputs.team_id,
            user=inputs.user,
            password=inputs.password,
            host=inputs.host,
            port=inputs.port,
            database=inputs.database,
            schema=inputs.schema,
            table_name=inputs.table_name,
            has_self_signed_cert=inputs.has_self_signed_cert,
            data_interval_start=data_interval_start.isoformat(),
            data_interval_end=data_interval_end.isoformat(),
            exclude_events=inputs.exclude_events,
            include_events=inputs.include_events,
        )

        try:
            await workflow.execute_activity(
                insert_into_postgres_activity,
                insert_inputs,
                start_to_close_timeout=dt.timedelta(hours=1),
                retry_policy=RetryPolicy(
                    initial_interval=dt.timedelta(seconds=10),
                    maximum_interval=dt.timedelta(seconds=120),
                    maximum_attempts=10,
                    non_retryable_error_types=[
                        # Raised on errors that are related to database operation.
                        # For example: unexpected disconnect, database or other object not found.
                        "OperationalError"
                        # The schema name provided is invalid (usually because it doesn't exist).
                        "InvalidSchemaName"
                        # Missing permissions to, e.g., insert into table.
                        "InsufficientPrivilege"
                    ],
                ),
            )

        except exceptions.ActivityError as e:
            if isinstance(e.cause, exceptions.CancelledError):
                logger.error("Postgres BatchExport was cancelled.")
                update_inputs.status = "Cancelled"
            else:
                logger.exception("Postgres BatchExport failed.", exc_info=e.cause)
                update_inputs.status = "Failed"

            update_inputs.latest_error = str(e.cause)
            raise

        except Exception as e:
            logger.exception("Postgers BatchExport failed with an unexpected error.", exc_info=e)
            update_inputs.status = "Failed"
            update_inputs.latest_error = "An unexpected error has ocurred"
            raise

        else:
            logger.info("Successfully finished Postgres export batch %s - %s", data_interval_start, data_interval_end)

        finally:
            await workflow.execute_activity(
                update_export_run_status,
                update_inputs,
                start_to_close_timeout=dt.timedelta(minutes=5),
                retry_policy=RetryPolicy(
                    initial_interval=dt.timedelta(seconds=10),
                    maximum_interval=dt.timedelta(seconds=60),
                    maximum_attempts=0,
                    non_retryable_error_types=["NotNullViolation", "IntegrityError"],
                ),
            )
