import { afterMount, connect, kea, listeners, path, selectors, actions, reducers } from 'kea'
import { loaders } from 'kea-loaders'
import api from 'lib/api'
import Fuse from 'fuse.js'
import { AvailableFeature, Breadcrumb, ProgressStatus, Survey } from '~/types'
import { urls } from 'scenes/urls'

import type { surveysLogicType } from './surveysLogicType'
import { lemonToast } from '@posthog/lemon-ui'
import { userLogic } from 'scenes/userLogic'
import { router } from 'kea-router'
import { pluginsLogic } from 'scenes/plugins/pluginsLogic'
import { LemonSelectOption } from 'lib/lemon-ui/LemonSelect'

export function getSurveyStatus(survey: Survey): ProgressStatus {
    if (!survey.start_date) {
        return ProgressStatus.Draft
    } else if (!survey.end_date) {
        return ProgressStatus.Running
    }
    return ProgressStatus.Complete
}

export interface SurveysFilters {
    status: string
    created_by: string
    archived: boolean
}

interface SurveysCreators {
    [id: string]: string
}

export const surveysLogic = kea<surveysLogicType>([
    path(['scenes', 'surveys', 'surveysLogic']),
    connect(() => ({
        values: [pluginsLogic, ['loading as pluginsLoading', 'enabledPlugins'], userLogic, ['user']],
    })),
    actions({
        setSearchTerm: (searchTerm: string) => ({ searchTerm }),
        setSurveysFilters: (filters: Partial<SurveysFilters>, replace?: boolean) => ({ filters, replace }),
    }),
    loaders(({ values }) => ({
        surveys: {
            __default: [] as Survey[],
            loadSurveys: async () => {
                const responseSurveys = await api.surveys.list()
                return responseSurveys.results
            },
            deleteSurvey: async (id) => {
                await api.surveys.delete(id)
                return values.surveys.filter((survey) => survey.id !== id)
            },
            updateSurvey: async ({ id, updatePayload }) => {
                const updatedSurvey = await api.surveys.update(id, { ...updatePayload })
                return values.surveys.map((survey) => (survey.id === id ? updatedSurvey : survey))
            },
        },
        surveysResponsesCount: {
            __default: {} as { [key: string]: number },
            loadResponsesCount: async () => {
                const surveysResponsesCount = await api.surveys.getResponsesCount()
                return surveysResponsesCount
            },
        },
    })),
    reducers({
        searchTerm: {
            setSearchTerm: (_, { searchTerm }) => searchTerm,
        },
        filters: [
            {
                archived: false,
                status: 'any',
                created_by: 'any',
            } as Partial<SurveysFilters>,
            {
                setSurveysFilters: (state, { filters }) => {
                    return { ...state, ...filters }
                },
            },
        ],
    }),
    listeners(({ actions }) => ({
        deleteSurveySuccess: () => {
            lemonToast.success('Survey deleted')
            router.actions.push(urls.surveys())
        },
        updateSurveySuccess: () => {
            lemonToast.success('Survey updated')
        },
        setSurveysFilters: () => {
            actions.loadSurveys()
            actions.loadResponsesCount()
        },
    })),
    selectors({
        searchedSurveys: [
            (selectors) => [selectors.surveys, selectors.searchTerm, selectors.filters],
            (surveys, searchTerm, filters) => {
                let searchedSurveys = surveys

                if (!searchTerm && Object.keys(filters).length === 0) {
                    return searchedSurveys
                }

                if (searchTerm) {
                    searchedSurveys = new Fuse(searchedSurveys, {
                        keys: ['key', 'name'],
                        threshold: 0.3,
                    })
                        .search(searchTerm)
                        .map((result) => result.item)
                }

                const { status, created_by, archived } = filters
                if (status !== 'any') {
                    searchedSurveys = searchedSurveys.filter((survey) => getSurveyStatus(survey) === status)
                }
                if (created_by !== 'any') {
                    searchedSurveys = searchedSurveys.filter(
                        (survey) => survey.created_by?.id === (created_by ? parseInt(created_by) : '')
                    )
                }

                if (archived) {
                    searchedSurveys = searchedSurveys.filter((survey) => survey.archived)
                } else {
                    searchedSurveys = searchedSurveys.filter((survey) => !survey.archived)
                }

                return searchedSurveys
            },
        ],
        breadcrumbs: [
            () => [],
            (): Breadcrumb[] => [
                {
                    name: 'Surveys',
                    path: urls.surveys(),
                },
            ],
        ],
        uniqueCreators: [
            (selectors) => [selectors.surveys],
            (surveys) => {
                const creators: SurveysCreators = {}
                for (const survey of surveys) {
                    if (survey.created_by) {
                        if (!creators[survey.created_by.id]) {
                            creators[survey.created_by.id] = survey.created_by.first_name
                        }
                    }
                }
                const response: LemonSelectOption<string>[] = [
                    { label: 'Any user', value: 'any' },
                    ...Object.entries(creators).map(([id, first_name]) => ({ label: first_name, value: id })),
                ]
                return response
            },
        ],
        whitelabelAvailable: [
            (s) => [s.user],
            (user) => (user?.organization?.available_features || []).includes(AvailableFeature.WHITE_LABELLING),
        ],
        usingSurveysSiteApp: [
            (s) => [s.enabledPlugins, s.pluginsLoading],
            (enabledPlugins, pluginsLoading): boolean => {
                return !!(!pluginsLoading && enabledPlugins.find((plugin) => plugin.name === 'Surveys app'))
            },
        ],
    }),
    afterMount(({ actions }) => {
        actions.loadSurveys()
        actions.loadResponsesCount()
    }),
])
