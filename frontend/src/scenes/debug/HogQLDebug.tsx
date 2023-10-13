import { HogQLQueryEditor } from '~/queries/nodes/HogQLQuery/HogQLQueryEditor'
import { DataNode, HogQLQuery } from '~/queries/schema'
import { DateRange } from '~/queries/nodes/DataNode/DateRange'
import { EventPropertyFilters } from '~/queries/nodes/EventsNode/EventPropertyFilters'
import { BindLogic, useValues } from 'kea'
import { dataNodeLogic, DataNodeLogicProps } from '~/queries/nodes/DataNode/dataNodeLogic'
import { ElapsedTime, Timings } from '~/queries/nodes/DataNode/ElapsedTime'
import { CodeSnippet, Language } from 'lib/components/CodeSnippet'
import { CodeEditor } from 'lib/components/CodeEditors'
import { LemonSelect } from 'lib/lemon-ui/LemonSelect'
import { LemonLabel } from 'lib/lemon-ui/LemonLabel'

interface HogQLDebugProps {
    query: HogQLQuery
    setQuery: (query: DataNode) => void
}
export function HogQLDebug({ query, setQuery }: HogQLDebugProps): JSX.Element {
    const dataNodeLogicProps: DataNodeLogicProps = { query, key: 'debug-scene' }
    const { dataLoading, response, responseErrorObject, elapsedTime } = useValues(dataNodeLogic(dataNodeLogicProps))
    return (
        <BindLogic logic={dataNodeLogic} props={dataNodeLogicProps}>
            <div className="space-y-2">
                <HogQLQueryEditor query={query} setQuery={setQuery} />
                <div className="flex gap-2">
                    <DateRange key="date-range" query={query} setQuery={setQuery} />
                    <EventPropertyFilters key="event-property" query={query} setQuery={setQuery} />
                </div>
                <div className="flex">
                    <LemonLabel>
                        POE:
                        <LemonSelect
                            options={[
                                { value: 'disabled', label: 'Disabled' },
                                { value: 'v1_enabled', label: 'V1 Enabled' },
                                { value: 'v2_enabled', label: 'V2 Enabled' },
                            ]}
                            onChange={(value) =>
                                setQuery({
                                    ...query,
                                    modifiers: { ...query.modifiers, personsOnEventsMode: value },
                                } as HogQLQuery)
                            }
                            value={(query.modifiers ?? response?.modifiers)?.personsOnEventsMode}
                        />
                    </LemonLabel>
                </div>
                {dataLoading ? (
                    <>
                        <h2>Running query...</h2>
                        <div className="flex">
                            Time elapsed: <ElapsedTime />
                        </div>
                    </>
                ) : (
                    <>
                        {response?.hogql ? (
                            <>
                                <h2>Executed HogQL</h2>
                                <CodeSnippet language={Language.SQL} wrap>
                                    {response.hogql}
                                </CodeSnippet>
                            </>
                        ) : null}
                        {response?.clickhouse ? (
                            <>
                                <h2>Executed ClickHouse SQL</h2>
                                <CodeSnippet language={Language.SQL} wrap>
                                    {response.clickhouse}
                                </CodeSnippet>
                            </>
                        ) : null}
                        {response?.timings && elapsedTime !== null ? (
                            <>
                                <h2>Time spent</h2>
                                <Timings timings={response.timings} elapsedTime={elapsedTime} />
                            </>
                        ) : null}
                        <h2>Raw response</h2>
                        <CodeEditor
                            className="border"
                            language={'json'}
                            value={JSON.stringify(response ?? responseErrorObject, null, 2)}
                            height={800}
                        />
                    </>
                )}
            </div>
        </BindLogic>
    )
}