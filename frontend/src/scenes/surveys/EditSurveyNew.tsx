import './EditSurvey.scss'
import { surveyLogic } from './surveyLogic'
import { BindLogic, useActions, useValues } from 'kea'
import { Group } from 'kea-forms'
import {
    LemonBanner,
    LemonButton,
    LemonCheckbox,
    LemonCollapse,
    LemonDivider,
    LemonInput,
    LemonSelect,
    LemonTabs,
    LemonTextArea,
} from '@posthog/lemon-ui'
import { Field, PureField } from 'lib/forms/Field'
import {
    SurveyQuestion,
    SurveyQuestionType,
    SurveyType,
    LinkSurveyQuestion,
    RatingSurveyQuestion,
    SurveyUrlMatchType,
} from '~/types'
import { FlagSelector } from 'scenes/early-access-features/EarlyAccessFeature'
import { IconCancel, IconDelete, IconPlus, IconPlusMini } from 'lib/lemon-ui/icons'
import {
    BaseAppearance,
    Customization,
    SurveyAppearance,
    SurveyMultipleChoiceAppearance,
    SurveyRatingAppearance,
} from './SurveyAppearance'
import { SurveyAPIEditor } from './SurveyAPIEditor'
import { featureFlagLogic } from 'scenes/feature-flags/featureFlagLogic'
import {
    defaultSurveyFieldValues,
    defaultSurveyAppearance,
    SurveyQuestionLabel,
    SurveyUrlMatchTypeLabels,
} from './constants'
import { FeatureFlagReleaseConditions } from 'scenes/feature-flags/FeatureFlagReleaseConditions'
import React, { useState } from 'react'
import { CodeEditor } from 'lib/components/CodeEditors'
import { FEATURE_FLAGS } from 'lib/constants'
import { featureFlagLogic as enabledFeaturesLogic } from 'lib/logic/featureFlagLogic'
import { SurveyFormAppearance } from './SurveyFormAppearance'

function PresentationTypeCard({
    title,
    description,
    children,
    onClick,
    value,
    active,
}: {
    title: string
    description?: string
    children: React.ReactNode
    onClick: () => void
    value: any
    active: boolean
}): JSX.Element {
    return (
        <div
            style={{ borderColor: active ? 'var(--primary)' : 'var(--border)', height: 230, width: 260 }}
            className="border rounded-md relative px-4 py-2 overflow-hidden"
        >
            <p className="font-semibold m-0">{title}</p>
            {description && <p className="m-0 text-xs">{description}</p>}
            <div className="relative mt-2 presentation-preview">{children}</div>
            <input
                onClick={onClick}
                className="opacity-0 absolute inset-0 h-full w-full cursor-pointer"
                name="type"
                value={value}
                type="radio"
            />
        </div>
    )
}

export default function EditSurveyNew(): JSX.Element {
    const { survey, hasTargetingFlag, urlMatchTypeValidationError, writingHTMLDescription, hasTargetingSet } =
        useValues(surveyLogic)
    const { setSurveyValue, setDefaultForQuestionType, setWritingHTMLDescription, resetTargeting } =
        useActions(surveyLogic)
    const { featureFlags } = useValues(enabledFeaturesLogic)

    const [activePreview, setActivePreview] = useState<number>(0)

    const showThankYou = survey.appearance.displayThankYouMessage && activePreview >= survey.questions.length

    return (
        <div className="flex flex-row gap-4">
            <div className="flex flex-col gap-2 flex-1 SurveyForm">
                <Field name="name" label="Name">
                    <LemonInput data-attr="survey-name" />
                </Field>
                <Field name="description" label="Description (optional)">
                    <LemonTextArea data-attr="survey-description" minRows={2} />
                </Field>
                <LemonCollapse
                    defaultActiveKey="steps"
                    panels={[
                        {
                            key: 'steps',
                            header: 'Steps',
                            content: (
                                <>
                                    <LemonCollapse
                                        activeKey={activePreview}
                                        onChange={(index) => setActivePreview(index || 0)}
                                        panels={[
                                            ...survey.questions.map(
                                                (
                                                    question:
                                                        | LinkSurveyQuestion
                                                        | SurveyQuestion
                                                        | RatingSurveyQuestion,
                                                    index: number
                                                ) => ({
                                                    key: index,
                                                    header: (
                                                        <div className="flex flex-row w-full items-center justify-between">
                                                            <b>
                                                                Question {index + 1}. {question.question}
                                                            </b>
                                                            {survey.questions.length > 1 && (
                                                                <LemonButton
                                                                    icon={<IconDelete />}
                                                                    status="primary-alt"
                                                                    data-attr={`delete-survey-question-${index}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setActivePreview(index <= 0 ? 0 : index - 1)
                                                                        setSurveyValue(
                                                                            'questions',
                                                                            survey.questions.filter(
                                                                                (_, i) => i !== index
                                                                            )
                                                                        )
                                                                    }}
                                                                    tooltipPlacement="topRight"
                                                                />
                                                            )}
                                                        </div>
                                                    ),
                                                    content: (
                                                        <Group name={`questions.${index}`} key={index}>
                                                            <div className="flex flex-col gap-2">
                                                                <Field name="question" label="Label">
                                                                    <LemonInput value={question.question} />
                                                                </Field>

                                                                <Field
                                                                    name="description"
                                                                    label="Description (optional)"
                                                                >
                                                                    {({ value, onChange }) => (
                                                                        <>
                                                                            <LemonTabs
                                                                                activeKey={
                                                                                    writingHTMLDescription
                                                                                        ? 'html'
                                                                                        : 'text'
                                                                                }
                                                                                onChange={(key) =>
                                                                                    setWritingHTMLDescription(
                                                                                        key === 'html'
                                                                                    )
                                                                                }
                                                                                tabs={[
                                                                                    {
                                                                                        key: 'text',
                                                                                        label: (
                                                                                            <span className="text-sm">
                                                                                                Text
                                                                                            </span>
                                                                                        ),
                                                                                        content: (
                                                                                            <LemonTextArea
                                                                                                data-attr="survey-description"
                                                                                                minRows={2}
                                                                                                value={value}
                                                                                                onChange={(v) =>
                                                                                                    onChange(v)
                                                                                                }
                                                                                            />
                                                                                        ),
                                                                                    },
                                                                                    {
                                                                                        key: 'html',
                                                                                        label: (
                                                                                            <span className="text-sm">
                                                                                                HTML
                                                                                            </span>
                                                                                        ),
                                                                                        content: (
                                                                                            <div>
                                                                                                <CodeEditor
                                                                                                    className="border"
                                                                                                    language="html"
                                                                                                    value={value}
                                                                                                    onChange={(v) =>
                                                                                                        onChange(
                                                                                                            v ?? ''
                                                                                                        )
                                                                                                    }
                                                                                                    height={150}
                                                                                                    options={{
                                                                                                        minimap: {
                                                                                                            enabled:
                                                                                                                false,
                                                                                                        },
                                                                                                        wordWrap: 'on',
                                                                                                        scrollBeyondLastLine:
                                                                                                            false,
                                                                                                        automaticLayout:
                                                                                                            true,
                                                                                                        fixedOverflowWidgets:
                                                                                                            true,
                                                                                                        lineNumbers:
                                                                                                            'off',
                                                                                                        glyphMargin:
                                                                                                            false,
                                                                                                        folding: false,
                                                                                                    }}
                                                                                                />
                                                                                            </div>
                                                                                        ),
                                                                                    },
                                                                                ]}
                                                                            />
                                                                            {question.description &&
                                                                                question.description
                                                                                    ?.toLowerCase()
                                                                                    .includes('<script') && (
                                                                                    <LemonBanner type="warning">
                                                                                        Scripts won't run in the survey
                                                                                        popup and we'll remove these on
                                                                                        save. Use the API question mode
                                                                                        to run your own scripts in
                                                                                        surveys.
                                                                                    </LemonBanner>
                                                                                )}
                                                                        </>
                                                                    )}
                                                                </Field>
                                                                <Field
                                                                    name="type"
                                                                    label="Question type"
                                                                    className="max-w-60"
                                                                >
                                                                    <LemonSelect
                                                                        data-attr={`survey-question-type-${index}`}
                                                                        onSelect={(newType) => {
                                                                            const isEditingQuestion =
                                                                                defaultSurveyFieldValues[question.type]
                                                                                    .questions[0].question !==
                                                                                question.question
                                                                            const isEditingDescription =
                                                                                defaultSurveyFieldValues[question.type]
                                                                                    .questions[0].description !==
                                                                                question.description
                                                                            const isEditingThankYouMessage =
                                                                                defaultSurveyFieldValues[question.type]
                                                                                    .appearance
                                                                                    .thankYouMessageHeader !==
                                                                                survey.appearance.thankYouMessageHeader
                                                                            setDefaultForQuestionType(
                                                                                index,
                                                                                newType,
                                                                                isEditingQuestion,
                                                                                isEditingDescription,
                                                                                isEditingThankYouMessage
                                                                            )
                                                                        }}
                                                                        options={[
                                                                            {
                                                                                label: SurveyQuestionLabel[
                                                                                    SurveyQuestionType.Open
                                                                                ],
                                                                                value: SurveyQuestionType.Open,
                                                                                tooltip: () => (
                                                                                    <BaseAppearance
                                                                                        preview
                                                                                        onSubmit={() => undefined}
                                                                                        appearance={{
                                                                                            ...survey.appearance,
                                                                                            whiteLabel: true,
                                                                                        }}
                                                                                        question="Share your thoughts"
                                                                                        description="Optional form description."
                                                                                        type={SurveyQuestionType.Open}
                                                                                    />
                                                                                ),
                                                                            },
                                                                            {
                                                                                label: 'Link',
                                                                                value: SurveyQuestionType.Link,
                                                                                tooltip: () => (
                                                                                    <BaseAppearance
                                                                                        preview
                                                                                        onSubmit={() => undefined}
                                                                                        appearance={{
                                                                                            ...survey.appearance,
                                                                                            whiteLabel: true,
                                                                                            submitButtonText:
                                                                                                'Register',
                                                                                        }}
                                                                                        question="Do you want to join our upcoming webinar?"
                                                                                        type={SurveyQuestionType.Link}
                                                                                    />
                                                                                ),
                                                                            },
                                                                            {
                                                                                label: 'Rating',
                                                                                value: SurveyQuestionType.Rating,
                                                                                tooltip: () => (
                                                                                    <SurveyRatingAppearance
                                                                                        preview
                                                                                        onSubmit={() => undefined}
                                                                                        appearance={{
                                                                                            ...survey.appearance,
                                                                                            whiteLabel: true,
                                                                                        }}
                                                                                        question="How satisfied are you with our product?"
                                                                                        description="Optional form description."
                                                                                        ratingSurveyQuestion={{
                                                                                            display: 'number',
                                                                                            lowerBoundLabel:
                                                                                                'Not great',
                                                                                            upperBoundLabel:
                                                                                                'Fantastic',
                                                                                            question:
                                                                                                'How satisfied are you with our product?',
                                                                                            scale: 5,
                                                                                            type: SurveyQuestionType.Rating,
                                                                                        }}
                                                                                    />
                                                                                ),
                                                                            },
                                                                            ...[
                                                                                {
                                                                                    label: 'Single choice select',
                                                                                    value: SurveyQuestionType.SingleChoice,
                                                                                    tooltip: () => (
                                                                                        <SurveyMultipleChoiceAppearance
                                                                                            initialChecked={[0]}
                                                                                            preview
                                                                                            onSubmit={() => undefined}
                                                                                            appearance={{
                                                                                                ...survey.appearance,
                                                                                                whiteLabel: true,
                                                                                            }}
                                                                                            question="Have you found this tutorial useful?"
                                                                                            multipleChoiceQuestion={{
                                                                                                type: SurveyQuestionType.SingleChoice,
                                                                                                choices: ['Yes', 'No'],
                                                                                                question:
                                                                                                    'Have you found this tutorial useful?',
                                                                                            }}
                                                                                        />
                                                                                    ),
                                                                                },
                                                                                {
                                                                                    label: 'Multiple choice select',
                                                                                    value: SurveyQuestionType.MultipleChoice,
                                                                                    tooltip: () => (
                                                                                        <SurveyMultipleChoiceAppearance
                                                                                            initialChecked={[0, 1]}
                                                                                            preview
                                                                                            onSubmit={() => undefined}
                                                                                            appearance={{
                                                                                                ...survey.appearance,
                                                                                                whiteLabel: true,
                                                                                            }}
                                                                                            question="Which types of content would you like to see more of?"
                                                                                            multipleChoiceQuestion={{
                                                                                                type: SurveyQuestionType.MultipleChoice,
                                                                                                choices: [
                                                                                                    'Tutorials',
                                                                                                    'Customer case studies',
                                                                                                    'Product announcements',
                                                                                                ],
                                                                                                question:
                                                                                                    'Which types of content would you like to see more of?',
                                                                                            }}
                                                                                        />
                                                                                    ),
                                                                                },
                                                                            ],
                                                                        ]}
                                                                    />
                                                                </Field>
                                                                {survey.questions.length > 1 && (
                                                                    <Field name="optional" className="my-2">
                                                                        <LemonCheckbox
                                                                            label="Optional"
                                                                            checked={!!question.optional}
                                                                        />
                                                                    </Field>
                                                                )}
                                                                {question.type === SurveyQuestionType.Link && (
                                                                    <Field
                                                                        name="link"
                                                                        label="Link"
                                                                        info="Make sure to include https:// in the url."
                                                                    >
                                                                        <LemonInput
                                                                            value={question.link || ''}
                                                                            placeholder="https://posthog.com"
                                                                        />
                                                                    </Field>
                                                                )}
                                                                {question.type === SurveyQuestionType.Rating && (
                                                                    <div className="flex flex-col gap-2">
                                                                        <div className="flex flex-row gap-4">
                                                                            <Field
                                                                                name="display"
                                                                                label="Display type"
                                                                                className="w-1/2"
                                                                            >
                                                                                <LemonSelect
                                                                                    options={[
                                                                                        {
                                                                                            label: 'Number',
                                                                                            value: 'number',
                                                                                        },
                                                                                        {
                                                                                            label: 'Emoji',
                                                                                            value: 'emoji',
                                                                                        },
                                                                                    ]}
                                                                                />
                                                                            </Field>
                                                                            <Field
                                                                                name="scale"
                                                                                label="Scale"
                                                                                className="w-1/2"
                                                                            >
                                                                                <LemonSelect
                                                                                    options={[
                                                                                        ...(question.display === 'emoji'
                                                                                            ? [
                                                                                                  {
                                                                                                      label: '1 - 3',
                                                                                                      value: 3,
                                                                                                  },
                                                                                              ]
                                                                                            : []),
                                                                                        {
                                                                                            label: '1 - 5',
                                                                                            value: 5,
                                                                                        },
                                                                                        ...(question.display ===
                                                                                        'number'
                                                                                            ? [
                                                                                                  {
                                                                                                      label: '1 - 10',
                                                                                                      value: 10,
                                                                                                  },
                                                                                              ]
                                                                                            : []),
                                                                                    ]}
                                                                                />
                                                                            </Field>
                                                                        </div>
                                                                        <div className="flex flex-row gap-4">
                                                                            <Field
                                                                                name="lowerBoundLabel"
                                                                                label="Lower bound label"
                                                                                className="w-1/2"
                                                                            >
                                                                                <LemonInput
                                                                                    value={
                                                                                        question.lowerBoundLabel || ''
                                                                                    }
                                                                                />
                                                                            </Field>
                                                                            <Field
                                                                                name="upperBoundLabel"
                                                                                label="Upper bound label"
                                                                                className="w-1/2"
                                                                            >
                                                                                <LemonInput
                                                                                    value={
                                                                                        question.upperBoundLabel || ''
                                                                                    }
                                                                                />
                                                                            </Field>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {(question.type === SurveyQuestionType.SingleChoice ||
                                                                    question.type ===
                                                                        SurveyQuestionType.MultipleChoice) && (
                                                                    <div className="flex flex-col gap-2">
                                                                        <Field name="choices" label="Choices">
                                                                            {({ value, onChange }) => (
                                                                                <div className="flex flex-col gap-2">
                                                                                    {(value || []).map(
                                                                                        (
                                                                                            choice: string,
                                                                                            index: number
                                                                                        ) => (
                                                                                            <div
                                                                                                className="flex flex-row gap-2"
                                                                                                key={index}
                                                                                            >
                                                                                                <LemonInput
                                                                                                    value={choice}
                                                                                                    fullWidth
                                                                                                    onChange={(val) => {
                                                                                                        const newChoices =
                                                                                                            [...value]
                                                                                                        newChoices[
                                                                                                            index
                                                                                                        ] = val
                                                                                                        onChange(
                                                                                                            newChoices
                                                                                                        )
                                                                                                    }}
                                                                                                />
                                                                                                <LemonButton
                                                                                                    icon={
                                                                                                        <IconDelete />
                                                                                                    }
                                                                                                    size="small"
                                                                                                    status="muted"
                                                                                                    noPadding
                                                                                                    onClick={() => {
                                                                                                        const newChoices =
                                                                                                            [...value]
                                                                                                        newChoices.splice(
                                                                                                            index,
                                                                                                            1
                                                                                                        )
                                                                                                        onChange(
                                                                                                            newChoices
                                                                                                        )
                                                                                                    }}
                                                                                                />
                                                                                            </div>
                                                                                        )
                                                                                    )}
                                                                                    <div className="w-fit">
                                                                                        {(value || []).length < 6 && (
                                                                                            <LemonButton
                                                                                                icon={<IconPlusMini />}
                                                                                                type="secondary"
                                                                                                fullWidth={false}
                                                                                                onClick={() => {
                                                                                                    if (!value) {
                                                                                                        onChange([''])
                                                                                                    } else {
                                                                                                        onChange([
                                                                                                            ...value,
                                                                                                            '',
                                                                                                        ])
                                                                                                    }
                                                                                                }}
                                                                                            >
                                                                                                Add choice
                                                                                            </LemonButton>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </Field>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </Group>
                                                    ),
                                                })
                                            ),
                                            ...(survey.appearance.displayThankYouMessage
                                                ? [
                                                      {
                                                          key: survey.questions.length,
                                                          header: (
                                                              <div className="flex flex-row w-full items-center justify-between">
                                                                  <b>Confirmation message</b>
                                                                  <LemonButton
                                                                      icon={<IconDelete />}
                                                                      status="primary-alt"
                                                                      data-attr={`delete-survey-confirmation`}
                                                                      onClick={(e) => {
                                                                          e.stopPropagation()
                                                                          setActivePreview(survey.questions.length - 1)
                                                                          setSurveyValue('appearance', {
                                                                              ...survey.appearance,
                                                                              displayThankYouMessage: false,
                                                                          })
                                                                      }}
                                                                      tooltipPlacement="topRight"
                                                                  />
                                                              </div>
                                                          ),
                                                          content: (
                                                              <>
                                                                  <PureField label="Thank you header">
                                                                      <LemonInput
                                                                          value={
                                                                              survey.appearance.thankYouMessageHeader
                                                                          }
                                                                          onChange={(val) =>
                                                                              setSurveyValue('appearance', {
                                                                                  ...survey.appearance,
                                                                                  thankYouMessageHeader: val,
                                                                              })
                                                                          }
                                                                          placeholder="ex: Thank you for your feedback!"
                                                                      />
                                                                  </PureField>
                                                                  <PureField label="Thank you description">
                                                                      <LemonTextArea
                                                                          value={
                                                                              survey.appearance
                                                                                  .thankYouMessageDescription
                                                                          }
                                                                          onChange={(val) =>
                                                                              setSurveyValue('appearance', {
                                                                                  ...survey.appearance,
                                                                                  thankYouMessageDescription: val,
                                                                              })
                                                                          }
                                                                          minRows={2}
                                                                          placeholder="ex: We really appreciate it."
                                                                      />
                                                                  </PureField>
                                                              </>
                                                          ),
                                                      },
                                                  ]
                                                : []),
                                        ]}
                                    />
                                    <div className="flex gap-2">
                                        {featureFlags[FEATURE_FLAGS.SURVEYS_MULTIPLE_QUESTIONS] && (
                                            // TODO: Add pay gate mini here once billing is resolved for it
                                            <LemonButton
                                                type="secondary"
                                                className="w-max mt-2"
                                                icon={<IconPlus />}
                                                onClick={() => {
                                                    setSurveyValue('questions', [
                                                        ...survey.questions,
                                                        { ...defaultSurveyFieldValues.open.questions[0] },
                                                    ])
                                                    setActivePreview(survey.questions.length)
                                                }}
                                            >
                                                Add question
                                            </LemonButton>
                                        )}
                                        {!survey.appearance.displayThankYouMessage && (
                                            <LemonButton
                                                type="secondary"
                                                className="w-max mt-2"
                                                icon={<IconPlus />}
                                                onClick={() => {
                                                    setSurveyValue('appearance', {
                                                        ...survey.appearance,
                                                        displayThankYouMessage: true,
                                                    })
                                                    setActivePreview(survey.questions.length)
                                                }}
                                            >
                                                Add confirmation message
                                            </LemonButton>
                                        )}
                                    </div>
                                </>
                            ),
                        },
                        {
                            key: 'presentation',
                            header: 'Presentation',
                            content: (
                                <Field name="type">
                                    {({ onChange, value }) => {
                                        return (
                                            <div className="flex gap-4">
                                                <PresentationTypeCard
                                                    active={value === SurveyType.Popover}
                                                    onClick={() => onChange(SurveyType.Popover)}
                                                    title="Popover"
                                                    description="Automatically appears when PostHog JS is installed"
                                                    value={SurveyType.Popover}
                                                >
                                                    <div
                                                        style={{
                                                            transform: 'scale(.8)',
                                                            position: 'absolute',
                                                            top: '-1rem',
                                                            left: '-1rem',
                                                        }}
                                                    >
                                                        <SurveyAppearance
                                                            preview
                                                            type={survey.questions[0].type}
                                                            surveyQuestionItem={survey.questions[0]}
                                                            question={survey.questions[0].question}
                                                            description={survey.questions[0].description}
                                                            link={
                                                                survey.questions[0].type === SurveyQuestionType.Link
                                                                    ? survey.questions[0].link
                                                                    : undefined
                                                            }
                                                            appearance={{
                                                                ...(survey.appearance || defaultSurveyAppearance),
                                                                ...(survey.questions.length > 1
                                                                    ? { submitButtonText: 'Next' }
                                                                    : null),
                                                            }}
                                                        />
                                                    </div>
                                                </PresentationTypeCard>
                                                <PresentationTypeCard
                                                    active={value === SurveyType.API}
                                                    onClick={() => onChange(SurveyType.API)}
                                                    title="API"
                                                    description="Use the PostHog API to show/hide your survey programmatically"
                                                    value={SurveyType.API}
                                                >
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            left: '1rem',
                                                            width: 350,
                                                        }}
                                                    >
                                                        <SurveyAPIEditor survey={survey} />
                                                    </div>
                                                </PresentationTypeCard>
                                            </div>
                                        )
                                    }}
                                </Field>
                            ),
                        },
                        ...(survey.type !== SurveyType.API
                            ? [
                                  {
                                      key: 'customization',
                                      header: 'Customization',
                                      content: (
                                          <Field name="appearance" label="">
                                              {({ value, onChange }) => (
                                                  <Customization
                                                      appearance={value || defaultSurveyAppearance}
                                                      surveyQuestionItem={survey.questions[0]}
                                                      onAppearanceChange={(appearance) => {
                                                          onChange(appearance)
                                                      }}
                                                  />
                                              )}
                                          </Field>
                                      ),
                                  },
                              ]
                            : []),
                        {
                            key: 'targeting',
                            header: 'Targeting',
                            content: (
                                <PureField>
                                    <LemonSelect
                                        onChange={(value) => {
                                            if (value) {
                                                resetTargeting()
                                            } else {
                                                // TRICKY: When attempting to set user match conditions
                                                // we want a proxy value to be set so that the user
                                                // can then edit these, or decide to go back to all user targeting
                                                setSurveyValue('conditions', { url: '' })
                                            }
                                        }}
                                        value={!hasTargetingSet}
                                        options={[
                                            { label: 'All users', value: true },
                                            { label: 'Users who match...', value: false },
                                        ]}
                                    />
                                    {!hasTargetingSet ? (
                                        <span className="text-muted">
                                            Survey <b>will be released to everyone</b>
                                        </span>
                                    ) : (
                                        <>
                                            <Field
                                                name="linked_flag_id"
                                                label="Link feature flag (optional)"
                                                info={
                                                    <>
                                                        Connecting to a feature flag will automatically enable this
                                                        survey for everyone in the feature flag.
                                                    </>
                                                }
                                            >
                                                {({ value, onChange }) => (
                                                    <div className="flex">
                                                        <FlagSelector value={value} onChange={onChange} />
                                                        {value && (
                                                            <LemonButton
                                                                className="ml-2"
                                                                icon={<IconCancel />}
                                                                size="small"
                                                                status="stealth"
                                                                onClick={() => onChange(null)}
                                                                aria-label="close"
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </Field>
                                            <Field name="conditions">
                                                {({ value, onChange }) => (
                                                    <>
                                                        <PureField
                                                            label="URL targeting"
                                                            error={urlMatchTypeValidationError}
                                                            info="Targeting by regex or exact match requires at least version 1.82 of posthog-js"
                                                        >
                                                            <div className="flex flex-row gap-2 items-center">
                                                                URL
                                                                <LemonSelect
                                                                    value={
                                                                        value?.urlMatchType ||
                                                                        SurveyUrlMatchType.Contains
                                                                    }
                                                                    onChange={(matchTypeVal) => {
                                                                        onChange({
                                                                            ...value,
                                                                            urlMatchType: matchTypeVal,
                                                                        })
                                                                    }}
                                                                    data-attr="survey-url-matching-type"
                                                                    options={Object.keys(SurveyUrlMatchTypeLabels).map(
                                                                        (key) => ({
                                                                            label: SurveyUrlMatchTypeLabels[key],
                                                                            value: key,
                                                                        })
                                                                    )}
                                                                />
                                                                <LemonInput
                                                                    value={value?.url}
                                                                    onChange={(urlVal) =>
                                                                        onChange({ ...value, url: urlVal })
                                                                    }
                                                                    placeholder="ex: https://app.posthog.com"
                                                                    fullWidth
                                                                />
                                                            </div>
                                                        </PureField>
                                                        <PureField label="Selector matches:">
                                                            <LemonInput
                                                                value={value?.selector}
                                                                onChange={(selectorVal) =>
                                                                    onChange({ ...value, selector: selectorVal })
                                                                }
                                                                placeholder="ex: .className or #id"
                                                            />
                                                        </PureField>
                                                        <PureField label="Survey wait period">
                                                            <div className="flex flex-row gap-2 items-center">
                                                                <LemonCheckbox
                                                                    checked={!!value?.seenSurveyWaitPeriodInDays}
                                                                    onChange={(checked) => {
                                                                        if (checked) {
                                                                            onChange({
                                                                                ...value,
                                                                                seenSurveyWaitPeriodInDays:
                                                                                    value?.seenSurveyWaitPeriodInDays ||
                                                                                    30,
                                                                            })
                                                                        } else {
                                                                            const {
                                                                                seenSurveyWaitPeriodInDays,
                                                                                ...rest
                                                                            } = value || {}
                                                                            onChange(rest)
                                                                        }
                                                                    }}
                                                                />
                                                                Do not display this survey to users who have already
                                                                seen a survey in the last
                                                                <LemonInput
                                                                    type="number"
                                                                    size="small"
                                                                    min={0}
                                                                    value={value?.seenSurveyWaitPeriodInDays}
                                                                    onChange={(val) => {
                                                                        if (val !== undefined && val > 0) {
                                                                            onChange({
                                                                                ...value,
                                                                                seenSurveyWaitPeriodInDays: val,
                                                                            })
                                                                        }
                                                                    }}
                                                                    className="w-16"
                                                                />{' '}
                                                                days.
                                                            </div>
                                                        </PureField>
                                                    </>
                                                )}
                                            </Field>
                                            <PureField label="User properties">
                                                <BindLogic
                                                    logic={featureFlagLogic}
                                                    props={{ id: survey.targeting_flag?.id || 'new' }}
                                                >
                                                    {!hasTargetingFlag && (
                                                        <LemonButton
                                                            type="secondary"
                                                            className="w-max"
                                                            onClick={() => {
                                                                setSurveyValue('targeting_flag_filters', { groups: [] })
                                                                setSurveyValue('remove_targeting_flag', false)
                                                            }}
                                                        >
                                                            Add user targeting
                                                        </LemonButton>
                                                    )}
                                                    {hasTargetingFlag && (
                                                        <>
                                                            <div className="mt-2">
                                                                <FeatureFlagReleaseConditions excludeTitle={true} />
                                                            </div>
                                                            <LemonButton
                                                                type="secondary"
                                                                status="danger"
                                                                className="w-max"
                                                                onClick={() => {
                                                                    setSurveyValue('targeting_flag_filters', null)
                                                                    setSurveyValue('targeting_flag', null)
                                                                    setSurveyValue('remove_targeting_flag', true)
                                                                }}
                                                            >
                                                                Remove all user properties
                                                            </LemonButton>
                                                        </>
                                                    )}
                                                </BindLogic>
                                            </PureField>
                                        </>
                                    )}
                                </PureField>
                            ),
                        },
                    ]}
                />
            </div>
            <LemonDivider vertical />
            <div className="flex flex-col items-center h-full w-full sticky top-0 pt-8" style={{ maxWidth: 320 }}>
                <SurveyFormAppearance
                    activePreview={activePreview}
                    survey={survey}
                    showThankYou={!!showThankYou}
                    setActivePreview={(preview) => setActivePreview(preview)}
                />
            </div>
        </div>
    )
}
