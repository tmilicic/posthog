import { lemonToast } from '@posthog/lemon-ui'
import { kea, path, props, key, listeners, afterMount, reducers, actions, selectors, connect } from 'kea'
import { forms } from 'kea-forms'
import { loaders } from 'kea-loaders'
import { actionToUrl, router, urlToAction } from 'kea-router'
import api from 'lib/api'
import { urls } from 'scenes/urls'
import {
    Breadcrumb,
    ChartDisplayType,
    PropertyFilterType,
    PropertyOperator,
    Survey,
    SurveyQuestionBase,
    SurveyQuestionType,
    SurveyUrlMatchType,
} from '~/types'
import type { surveyLogicType } from './surveyLogicType'
import { DataTableNode, InsightVizNode, HogQLQuery, NodeKind } from '~/queries/schema'
import { hogql } from '~/queries/utils'
import { surveysLogic } from './surveysLogic'
import { dayjs } from 'lib/dayjs'
import { eventUsageLogic } from 'lib/utils/eventUsageLogic'
import { featureFlagLogic } from 'scenes/feature-flags/featureFlagLogic'
import { featureFlagLogic as enabledFlagLogic } from 'lib/logic/featureFlagLogic'
import {
    defaultSurveyFieldValues,
    SURVEY_EVENT_NAME,
    SURVEY_RESPONSE_PROPERTY,
    NEW_SURVEY,
    NewSurvey,
} from './constants'
import { sanitize } from 'dompurify'

export interface SurveyLogicProps {
    id: string | 'new'
}

export interface SurveyMetricsQueries {
    surveysShown: DataTableNode
    surveysDismissed: DataTableNode
}

export interface SurveyUserStats {
    seen: number
    dismissed: number
    sent: number
}

export interface SurveyRatingResults {
    [key: number]: {
        data: number[]
        total: number
    }
}

export interface SurveySingleChoiceResults {
    [key: number]: {
        labels: string[]
        data: number[]
        total: number
    }
}

export interface SurveyMultipleChoiceResults {
    [key: number]: {
        labels: string[]
        data: number[]
    }
}

export interface QuestionResultsReady {
    [key: string]: boolean
}

export const surveyLogic = kea<surveyLogicType>([
    props({} as SurveyLogicProps),
    key(({ id }) => id),
    path((key) => ['scenes', 'surveys', 'surveyLogic', key]),
    connect(() => ({
        actions: [
            surveysLogic,
            ['loadSurveys'],
            eventUsageLogic,
            [
                'reportSurveyCreated',
                'reportSurveyLaunched',
                'reportSurveyEdited',
                'reportSurveyArchived',
                'reportSurveyStopped',
                'reportSurveyResumed',
                'reportSurveyViewed',
            ],
        ],
        values: [enabledFlagLogic, ['featureFlags as enabledFlags']],
    })),
    actions({
        setSurveyMissing: true,
        editingSurvey: (editing: boolean) => ({ editing }),
        setDefaultForQuestionType: (
            idx: number,
            type: SurveyQuestionType,
            isEditingQuestion: boolean,
            isEditingDescription: boolean,
            isEditingThankYouMessage: boolean
        ) => ({
            idx,
            type,
            isEditingQuestion,
            isEditingDescription,
            isEditingThankYouMessage,
        }),
        archiveSurvey: true,
        setCurrentQuestionIndexAndType: (idx: number, type: SurveyQuestionType) => ({ idx, type }),
        setWritingHTMLDescription: (writingHTML: boolean) => ({ writingHTML }),
        setSurveyTemplateValues: (template: any) => ({ template }),
        resetTargeting: true,
    }),
    loaders(({ props, actions, values }) => ({
        survey: {
            loadSurvey: async () => {
                if (props.id && props.id !== 'new') {
                    try {
                        const survey = await api.surveys.get(props.id)
                        actions.reportSurveyViewed(survey)
                        return survey
                    } catch (error: any) {
                        actions.setSurveyMissing()
                        throw error
                    }
                }
                if (props.id === 'new' && router.values.hashParams.fromTemplate) {
                    return values.survey
                } else {
                    return { ...NEW_SURVEY }
                }
            },
            createSurvey: async (surveyPayload: Partial<Survey>) => {
                return await api.surveys.create(sanitizeQuestions(surveyPayload))
            },
            updateSurvey: async (surveyPayload: Partial<Survey>) => {
                return await api.surveys.update(props.id, sanitizeQuestions(surveyPayload))
            },
            launchSurvey: async () => {
                const startDate = dayjs()
                return await api.surveys.update(props.id, { start_date: startDate.toISOString() })
            },
            stopSurvey: async () => {
                return await api.surveys.update(props.id, { end_date: dayjs().toISOString() })
            },
            resumeSurvey: async () => {
                return await api.surveys.update(props.id, { end_date: null })
            },
        },
        surveyUserStats: {
            loadSurveyUserStats: async (): Promise<SurveyUserStats> => {
                const { survey } = values
                const startDate = dayjs((survey as Survey).created_at).format('YYYY-MM-DD')
                const endDate = survey.end_date
                    ? dayjs(survey.end_date).add(1, 'day').format('YYYY-MM-DD')
                    : dayjs().add(1, 'day').format('YYYY-MM-DD')

                const query: HogQLQuery = {
                    kind: NodeKind.HogQLQuery,
                    query: hogql`
                        SELECT
                            (SELECT COUNT(DISTINCT person_id)
                                FROM events
                                WHERE event = 'survey shown'
                                    AND properties.$survey_id = ${props.id}
                                    AND timestamp >= ${startDate}
                                    AND timestamp <= ${endDate}),
                            (SELECT COUNT(DISTINCT person_id)
                                FROM events
                                WHERE event = 'survey dismissed'
                                    AND properties.$survey_id = ${props.id}
                                    AND timestamp >= ${startDate}
                                    AND timestamp <= ${endDate}),
                            (SELECT COUNT(DISTINCT person_id)
                                FROM events
                                WHERE event = 'survey sent'
                                    AND properties.$survey_id = ${props.id}
                                    AND timestamp >= ${startDate}
                                    AND timestamp <= ${endDate})
                    `,
                }
                const responseJSON = await api.query(query)
                const { results } = responseJSON
                if (results && results[0]) {
                    const [totalSeen, dismissed, sent] = results[0]
                    const onlySeen = totalSeen - dismissed - sent
                    return { seen: onlySeen < 0 ? 0 : onlySeen, dismissed, sent }
                } else {
                    return { seen: 0, dismissed: 0, sent: 0 }
                }
            },
        },
        surveyRatingResults: {
            loadSurveyRatingResults: async ({
                questionIndex,
            }: {
                questionIndex: number
            }): Promise<SurveyRatingResults> => {
                const { survey } = values

                const question = values.survey.questions[questionIndex]
                if (question.type !== SurveyQuestionType.Rating) {
                    throw new Error(`Survey question type must be ${SurveyQuestionType.Rating}`)
                }

                const startDate = dayjs((survey as Survey).created_at).format('YYYY-MM-DD')
                const endDate = survey.end_date
                    ? dayjs(survey.end_date).add(1, 'day').format('YYYY-MM-DD')
                    : dayjs().add(1, 'day').format('YYYY-MM-DD')

                const surveyResponseField =
                    questionIndex === 0 ? '$survey_response' : `$survey_response_${questionIndex}`

                const query: HogQLQuery = {
                    kind: NodeKind.HogQLQuery,
                    query: `
                        SELECT properties.${surveyResponseField} AS survey_response, COUNT(survey_response)
                        FROM events
                        WHERE event = 'survey sent' 
                            AND properties.$survey_id = '${props.id}'
                            AND timestamp >= '${startDate}'
                            AND timestamp <= '${endDate}'
                        GROUP BY survey_response
                    `,
                }
                const responseJSON = await api.query(query)
                const { results } = responseJSON

                let total = 0
                const data = new Array(question.scale).fill(0)
                results?.forEach(([value, count]) => {
                    total += count
                    data[value - 1] = count
                })

                return { ...values.surveyRatingResults, [questionIndex]: { total, data } }
            },
        },
        surveySingleChoiceResults: {
            loadSurveySingleChoiceResults: async ({
                questionIndex,
            }: {
                questionIndex: number
            }): Promise<SurveySingleChoiceResults> => {
                const { survey } = values
                const startDate = dayjs((survey as Survey).created_at).format('YYYY-MM-DD')
                const endDate = survey.end_date
                    ? dayjs(survey.end_date).add(1, 'day').format('YYYY-MM-DD')
                    : dayjs().add(1, 'day').format('YYYY-MM-DD')

                const surveyResponseField =
                    questionIndex === 0 ? '$survey_response' : `$survey_response_${questionIndex}`

                const query: HogQLQuery = {
                    kind: NodeKind.HogQLQuery,
                    query: `
                        SELECT properties.${surveyResponseField} AS survey_response, COUNT(survey_response)
                        FROM events
                        WHERE event = 'survey sent' 
                            AND properties.$survey_id = '${props.id}'
                            AND timestamp >= '${startDate}'
                            AND timestamp <= '${endDate}'
                        GROUP BY survey_response
                    `,
                }
                const responseJSON = await api.query(query)
                const { results } = responseJSON

                const labels = results?.map((r) => r[0])
                const data = results?.map((r) => r[1])
                const total = data?.reduce((a, b) => a + b, 0)

                return { ...values.surveySingleChoiceResults, [questionIndex]: { labels, data, total } }
            },
        },
        surveyMultipleChoiceResults: {
            loadSurveyMultipleChoiceResults: async ({
                questionIndex,
            }: {
                questionIndex: number
            }): Promise<SurveyMultipleChoiceResults> => {
                const { survey } = values

                const question = values.survey.questions[questionIndex]
                if (question.type !== SurveyQuestionType.MultipleChoice) {
                    throw new Error(`Survey question type must be ${SurveyQuestionType.MultipleChoice}`)
                }

                const startDate = dayjs((survey as Survey).created_at).format('YYYY-MM-DD')
                const endDate = survey.end_date
                    ? dayjs(survey.end_date).add(1, 'day').format('YYYY-MM-DD')
                    : dayjs().add(1, 'day').format('YYYY-MM-DD')

                const query: HogQLQuery = {
                    kind: NodeKind.HogQLQuery,
                    query: `
                        SELECT count(), arrayJoin(JSONExtractArrayRaw(properties, '$survey_response')) AS choice
                        FROM events
                        WHERE event == 'survey sent'
                            AND properties.$survey_id == '${survey.id}'
                            AND timestamp >= '${startDate}'
                            AND timestamp <= '${endDate}'
                        GROUP BY choice
                        ORDER BY count() DESC
                    `,
                }
                const responseJSON = await api.query(query)
                let { results } = responseJSON

                // Remove outside quotes
                results = results?.map((r) => {
                    return [r[0], r[1].slice(1, r[1].length - 1)]
                })

                // Zero-fill
                question.choices.forEach((choice) => {
                    if (results?.length && !results.some((r) => r[1] === choice)) {
                        results.push([0, choice])
                    }
                })

                const data = results?.map((r) => r[0])
                const labels = results?.map((r) => r[1])

                return { ...values.surveyRatingResults, [questionIndex]: { labels, data } }
            },
        },
    })),
    listeners(({ actions }) => ({
        createSurveySuccess: ({ survey }) => {
            lemonToast.success(<>Survey {survey.name} created</>)
            actions.loadSurveys()
            router.actions.replace(urls.survey(survey.id))
            actions.reportSurveyCreated(survey)
        },
        updateSurveySuccess: ({ survey }) => {
            lemonToast.success(<>Survey {survey.name} updated</>)
            actions.editingSurvey(false)
            actions.reportSurveyEdited(survey)
            actions.loadSurveys()
        },
        launchSurveySuccess: ({ survey }) => {
            lemonToast.success(<>Survey {survey.name} launched</>)
            actions.loadSurveys()
            actions.reportSurveyLaunched(survey)
        },
        stopSurveySuccess: ({ survey }) => {
            actions.loadSurveys()
            actions.reportSurveyStopped(survey)
        },
        resumeSurveySuccess: ({ survey }) => {
            actions.loadSurveys()
            actions.reportSurveyResumed(survey)
        },
        archiveSurvey: async () => {
            actions.updateSurvey({ archived: true })
        },
        loadSurveySuccess: ({ survey }) => {
            actions.setCurrentQuestionIndexAndType(0, survey.questions[0].type)
            actions.loadSurveyUserStats()
        },
        resetTargeting: () => {
            actions.setSurveyValue('linked_flag_id', NEW_SURVEY.linked_flag_id)
            actions.setSurveyValue('targeting_flag_filters', NEW_SURVEY.targeting_flag_filters)
            actions.setSurveyValue('linked_flag', NEW_SURVEY.linked_flag)
            actions.setSurveyValue('targeting_flag', NEW_SURVEY.targeting_flag)
            actions.setSurveyValue('conditions', NEW_SURVEY.conditions)
            actions.setSurveyValue('remove_targeting_flag', true)
        },
    })),
    reducers({
        isEditingSurvey: [
            false,
            {
                editingSurvey: (_, { editing }) => editing,
            },
        ],
        surveyMissing: [
            false,
            {
                setSurveyMissing: () => true,
            },
        ],
        survey: [
            { ...NEW_SURVEY } as NewSurvey | Survey,
            {
                setDefaultForQuestionType: (
                    state,
                    { idx, type, isEditingQuestion, isEditingDescription, isEditingThankYouMessage }
                ) => {
                    const question = isEditingQuestion
                        ? state.questions[idx].question
                        : defaultSurveyFieldValues[type].questions[0].question
                    const description = isEditingDescription
                        ? state.questions[idx].description
                        : defaultSurveyFieldValues[type].questions[0].description
                    const thankYouMessageHeader = isEditingThankYouMessage
                        ? state.appearance.thankYouMessageHeader
                        : defaultSurveyFieldValues[type].appearance.thankYouMessageHeader
                    const newQuestions = [...state.questions]
                    newQuestions[idx] = {
                        ...state.questions[idx],
                        ...(defaultSurveyFieldValues[type].questions[0] as SurveyQuestionBase),
                        question,
                        description,
                    }
                    return {
                        ...state,
                        questions: newQuestions,
                        appearance: {
                            ...state.appearance,
                            ...defaultSurveyFieldValues[type].appearance,
                            thankYouMessageHeader,
                        },
                    }
                },
                setSurveyTemplateValues: (_, { template }) => {
                    const newTemplateSurvey = { ...NEW_SURVEY, ...template }
                    return newTemplateSurvey
                },
            },
        ],
        currentQuestionIndexAndType: [
            { idx: 0, type: SurveyQuestionType.Open } as { idx: number; type: SurveyQuestionType },
            {
                setCurrentQuestionIndexAndType: (_, { idx, type }) => ({ idx, type }),
            },
        ],
        surveyRatingResultsReady: [
            {},
            {
                loadSurveyRatingResultsSuccess: (state, { payload }) => {
                    if (!payload || !payload.hasOwnProperty('questionIndex')) {
                        return { ...state }
                    }
                    return { ...state, [payload.questionIndex]: true }
                },
            },
        ],
        surveySingleChoiceResultsReady: [
            {},
            {
                loadSurveySingleChoiceResultsSuccess: (state, { payload }) => {
                    if (!payload || !payload.hasOwnProperty('questionIndex')) {
                        return { ...state }
                    }
                    return { ...state, [payload.questionIndex]: true }
                },
            },
        ],
        surveyMultipleChoiceResultsReady: [
            {},
            {
                loadSurveyMultipleChoiceResultsSuccess: (state, { payload }) => {
                    if (!payload || !payload.hasOwnProperty('questionIndex')) {
                        return { ...state }
                    }
                    return { ...state, [payload.questionIndex]: true }
                },
            },
        ],
        writingHTMLDescription: [
            false,
            {
                setWritingHTMLDescription: (_, { writingHTML }) => writingHTML,
            },
        ],
    }),
    selectors({
        isSurveyRunning: [
            (s) => [s.survey],
            (survey: Survey): boolean => {
                return !!(survey.start_date && !survey.end_date)
            },
        ],
        hasTargetingSet: [
            (s) => [s.survey],
            (survey: Survey): boolean => {
                const hasLinkedFlag =
                    !!survey.linked_flag_id || (survey.linked_flag && Object.keys(survey.linked_flag).length > 0)
                const hasTargetingFlag =
                    (survey.targeting_flag && Object.keys(survey.targeting_flag).length > 0) ||
                    (survey.targeting_flag_filters && Object.keys(survey.targeting_flag_filters).length > 0)
                const hasOtherConditions = survey.conditions && Object.keys(survey.conditions).length > 0
                return !!hasLinkedFlag || !!hasTargetingFlag || !!hasOtherConditions
            },
        ],
        breadcrumbs: [
            (s) => [s.survey],
            (survey: Survey): Breadcrumb[] => [
                {
                    name: 'Surveys',
                    path: urls.surveys(),
                },
                ...(survey?.name ? [{ name: survey.name }] : []),
            ],
        ],
        surveyResponseProperty: [
            (s) => [s.currentQuestionIndexAndType],
            (currentQuestionIndexAndType): string => {
                return currentQuestionIndexAndType.idx === 0
                    ? SURVEY_RESPONSE_PROPERTY
                    : `${SURVEY_RESPONSE_PROPERTY}_${currentQuestionIndexAndType.idx}`
            },
        ],
        dataTableQuery: [
            (s) => [s.survey, s.surveyResponseProperty],
            (survey, surveyResponseProperty): DataTableNode | null => {
                if (survey.id === 'new') {
                    return null
                }
                const createdAt = (survey as Survey).created_at
                return {
                    kind: NodeKind.DataTableNode,
                    source: {
                        kind: NodeKind.EventsQuery,
                        select: ['*', `properties.${surveyResponseProperty}`, 'timestamp', 'person'],
                        orderBy: ['timestamp DESC'],
                        where: [`event == 'survey sent'`],
                        after: createdAt,
                        properties: [
                            {
                                type: PropertyFilterType.Event,
                                key: '$survey_id',
                                operator: PropertyOperator.Exact,
                                value: survey.id,
                            },
                        ],
                    },
                    propertiesViaUrl: true,
                    showExport: true,
                    showReload: true,
                    showEventFilter: true,
                    showPropertyFilter: true,
                    showTimings: false,
                }
            },
        ],
        surveyMetricsQueries: [
            (s) => [s.survey],
            (survey): SurveyMetricsQueries | null => {
                const surveyId = survey.id
                if (surveyId === 'new') {
                    return null
                }
                const startDate = dayjs((survey as Survey).created_at).format('YYYY-MM-DD')
                const endDate = survey.end_date
                    ? dayjs(survey.end_date).add(1, 'day').format('YYYY-MM-DD')
                    : dayjs().add(1, 'day').format('YYYY-MM-DD')

                const surveysShownHogqlQuery = `select count(distinct person.id) as 'survey shown' from events where event == 'survey shown' and properties.$survey_id == '${surveyId}' and timestamp >= '${startDate}' and timestamp <= '${endDate}' `
                const surveysDismissedHogqlQuery = `select count(distinct person.id) as 'survey dismissed' from events where event == 'survey dismissed' and properties.$survey_id == '${surveyId}' and timestamp >= '${startDate}' and timestamp <= '${endDate}'`
                return {
                    surveysShown: {
                        kind: NodeKind.DataTableNode,
                        source: {
                            kind: NodeKind.HogQLQuery,
                            query: surveysShownHogqlQuery,
                        },
                        showTimings: false,
                    },
                    surveysDismissed: {
                        kind: NodeKind.DataTableNode,
                        source: {
                            kind: NodeKind.HogQLQuery,
                            query: surveysDismissedHogqlQuery,
                        },
                        showTimings: false,
                    },
                }
            },
        ],
        surveyRatingQuery: [
            (s) => [s.survey, s.surveyResponseProperty],
            (survey, surveyResponseProperty): InsightVizNode | null => {
                if (survey.id === 'new') {
                    return null
                }
                const startDate = dayjs((survey as Survey).created_at).format('YYYY-MM-DD')
                const endDate = survey.end_date
                    ? dayjs(survey.end_date).add(1, 'day').format('YYYY-MM-DD')
                    : dayjs().add(1, 'day').format('YYYY-MM-DD')

                return {
                    kind: NodeKind.InsightVizNode,
                    source: {
                        kind: NodeKind.TrendsQuery,
                        dateRange: {
                            date_from: startDate,
                            date_to: endDate,
                        },
                        properties: [
                            {
                                type: PropertyFilterType.Event,
                                key: '$survey_id',
                                operator: PropertyOperator.Exact,
                                value: survey.id,
                            },
                        ],
                        series: [{ event: SURVEY_EVENT_NAME, kind: NodeKind.EventsNode }],
                        trendsFilter: { display: ChartDisplayType.ActionsBarValue },
                        breakdown: { breakdown: surveyResponseProperty, breakdown_type: 'event' },
                    },
                    showTable: true,
                }
            },
        ],
        surveyMultipleChoiceQuery: [
            (s) => [s.survey, s.surveyResponseProperty, s.currentQuestionIndexAndType],
            (survey, surveyResponseProperty, currentQuestionIndexAndType): DataTableNode | null => {
                if (survey.id === 'new') {
                    return null
                }

                const startDate = dayjs((survey as Survey).created_at).format('YYYY-MM-DD')
                const endDate = survey.end_date
                    ? dayjs(survey.end_date).add(1, 'day').format('YYYY-MM-DD')
                    : dayjs().add(1, 'day').format('YYYY-MM-DD')

                const singleChoiceQuery = `select count(), properties.${surveyResponseProperty} as choice from events where event == 'survey sent' and properties.$survey_id == '${survey.id}' and timestamp >= '${startDate}' and timestamp <= '${endDate}' group by choice order by count() desc`
                const multipleChoiceQuery = `select count(), arrayJoin(JSONExtractArrayRaw(properties, '${surveyResponseProperty}')) as choice from events where event == 'survey sent' and properties.$survey_id == '${survey.id}' and timestamp >= '${startDate}' and timestamp <= '${endDate}'  group by choice order by count() desc`
                return {
                    kind: NodeKind.DataTableNode,
                    source: {
                        kind: NodeKind.HogQLQuery,
                        query:
                            currentQuestionIndexAndType.type === SurveyQuestionType.SingleChoice
                                ? singleChoiceQuery
                                : multipleChoiceQuery,
                    },
                    showTimings: false,
                }
            },
        ],
        hasTargetingFlag: [
            (s) => [s.survey],
            (survey): boolean => {
                return !!survey.targeting_flag || !!survey.targeting_flag_filters
            },
        ],
        urlMatchTypeValidationError: [
            (s) => [s.survey],
            (survey): string | null => {
                if (survey.conditions?.urlMatchType === SurveyUrlMatchType.Regex && survey.conditions.url) {
                    try {
                        new RegExp(survey.conditions.url)
                    } catch (e: any) {
                        return e.message
                    }
                }
                return null
            },
        ],
    }),
    forms(({ actions, props, values }) => ({
        survey: {
            defaults: { ...NEW_SURVEY } as NewSurvey | Survey,
            errors: ({ name, questions }) => ({
                name: !name && 'Please enter a name.',
                questions: questions.map((question) => ({
                    question: !question.question && 'Please enter a question.',
                    ...(question.type === SurveyQuestionType.Link
                        ? { link: !question.link && 'Please enter a url for the link.' }
                        : {}),
                    ...(question.type === SurveyQuestionType.Rating
                        ? {
                              display: !question.display && 'Please choose a display type.',
                              scale: !question.scale && 'Please choose a scale.',
                          }
                        : {}),
                })),
                // controlled using a PureField in the form
                urlMatchType: values.urlMatchTypeValidationError,
            }),
            submit: async (surveyPayload) => {
                let surveyPayloadWithTargetingFlagFilters = surveyPayload
                const flagLogic = featureFlagLogic({ id: values.survey.targeting_flag?.id || 'new' })
                if (values.hasTargetingFlag) {
                    const targetingFlag = flagLogic.values.featureFlag
                    surveyPayloadWithTargetingFlagFilters = {
                        ...surveyPayload,
                        ...{ targeting_flag_filters: targetingFlag.filters },
                    }
                }
                if (props.id && props.id !== 'new') {
                    actions.updateSurvey(surveyPayloadWithTargetingFlagFilters)
                } else {
                    actions.createSurvey(surveyPayloadWithTargetingFlagFilters)
                }
            },
        },
    })),
    urlToAction(({ actions, props }) => ({
        [urls.survey(props.id ?? 'new')]: (_, __, ___, { method }) => {
            // If the URL was pushed (user clicked on a link), reset the scene's data.
            // This avoids resetting form fields if you click back/forward.
            if (method === 'PUSH') {
                if (props.id) {
                    actions.loadSurvey()
                } else {
                    actions.resetSurvey()
                }
            }
        },
    })),
    actionToUrl(({ values }) => ({
        setSurveyTemplateValues: () => {
            const hashParams = router.values.hashParams
            hashParams['fromTemplate'] = true

            return [urls.survey(values.survey.id), router.values.searchParams, hashParams]
        },
    })),
    afterMount(async ({ props, actions }) => {
        if (props.id !== 'new') {
            await actions.loadSurvey()
        }
        if (props.id === 'new') {
            await actions.resetSurvey()
        }
    }),
])

function sanitizeQuestions(surveyPayload: Partial<Survey>): Partial<Survey> {
    if (!surveyPayload.questions) {
        return surveyPayload
    }
    return {
        ...surveyPayload,
        questions: surveyPayload.questions?.map((rawQuestion) => {
            return {
                ...rawQuestion,
                description: sanitize(rawQuestion.description || ''),
                question: sanitize(rawQuestion.question || ''),
            }
        }),
    }
}
