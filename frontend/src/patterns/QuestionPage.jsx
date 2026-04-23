import { useId } from 'react';

import { Checkbox, InlineMessage, Radio, Select, SurfaceCard, TextArea } from '../components/ui/index.js';
import { cn } from '../lib/ui.js';

function mergeDescribedBy(...ids) {
  return ids.filter(Boolean).join(' ') || undefined;
}

function normalizeMultiValue(value, values) {
  if (Array.isArray(values)) return values;
  if (Array.isArray(value)) return value;
  return [];
}

function buildNextMultiValue(options, selectedValues, optionValue, checked) {
  const selected = new Set(selectedValues);

  if (checked) {
    selected.add(optionValue);
  } else {
    selected.delete(optionValue);
  }

  return options.map((option) => option.value).filter((optionValueKey) => selected.has(optionValueKey));
}

export default function QuestionPage({
  id,
  type = 'single',
  eyebrow,
  title,
  prompt,
  description,
  meta,
  name,
  options = [],
  value,
  values,
  onValueChange,
  placeholder = 'Selecciona una opcion',
  textPlaceholder,
  error,
  errorId: errorIdProp,
  errorTitle = 'Revisa esta respuesta',
  required = false,
  help,
  actions,
  footer,
  className,
  children,
  'aria-describedby': ariaDescribedBy,
}) {
  const generatedId = useId();
  const questionId = id || generatedId;
  const headingId = `${questionId}-heading`;
  const descriptionId = description ? `${questionId}-description` : undefined;
  const errorId = error ? errorIdProp || `${questionId}-error` : undefined;
  const helpId = help ? `${questionId}-help` : undefined;
  const controlName = name || questionId;
  const questionTitle = title || prompt;
  const describedBy = mergeDescribedBy(ariaDescribedBy, descriptionId, errorId, helpId);
  const selectedValues = normalizeMultiValue(value, values);
  const controlled = value !== undefined || values !== undefined;

  const renderChoiceOptions = (choiceType) => {
    const ChoiceControl = choiceType === 'multi' ? Checkbox : Radio;

    const handleChoiceChange = (option, event) => {
      if (!onValueChange) return;

      if (choiceType === 'multi') {
        onValueChange(buildNextMultiValue(options, selectedValues, option.value, event.target.checked), event);
        return;
      }

      onValueChange(option.value, event);
    };

    return (
      <fieldset
        className="sd-question-fieldset"
        aria-describedby={describedBy}
        aria-invalid={error ? 'true' : undefined}
        aria-required={required ? 'true' : undefined}
      >
        <legend className="sr-only">{questionTitle}</legend>
        <div className="sd-question-options" data-type={choiceType}>
          {options.map((option, index) => {
            const optionId = `${questionId}-${choiceType}-${index}`;
            const optionChecked =
              choiceType === 'multi'
                ? selectedValues.includes(option.value)
                : value === option.value;
            const choiceProps = controlled
              ? {
                  checked: optionChecked,
                  readOnly: onValueChange ? undefined : true,
                  onChange: (event) => handleChoiceChange(option, event),
                }
              : {
                  defaultChecked: option.defaultChecked,
                  onChange: onValueChange ? (event) => handleChoiceChange(option, event) : undefined,
                };

            return (
              <ChoiceControl
                key={option.value ?? optionId}
                id={option.id || optionId}
                name={controlName}
                value={option.value}
                label={option.label}
                hint={option.hint}
                disabled={option.disabled}
                invalid={Boolean(error)}
                aria-describedby={describedBy}
                {...choiceProps}
              />
            );
          })}
        </div>
      </fieldset>
    );
  };

  const renderSelect = () => {
    const selectValueProps =
      value !== undefined
        ? {
            value: value ?? '',
            onChange: (event) => onValueChange?.(event.target.value, event),
          }
        : {
            onChange: onValueChange ? (event) => onValueChange(event.target.value, event) : undefined,
          };

    return (
      <div className="sd-question-input-block">
        <Select
          id={`${questionId}-select`}
          name={controlName}
          required={required}
          invalid={Boolean(error)}
          aria-labelledby={headingId}
          aria-describedby={describedBy}
          {...selectValueProps}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
    );
  };

  const renderText = () => {
    const textValueProps =
      value !== undefined
        ? {
            value: value ?? '',
            onChange: (event) => onValueChange?.(event.target.value, event),
          }
        : {
            onChange: onValueChange ? (event) => onValueChange(event.target.value, event) : undefined,
          };

    return (
      <div className="sd-question-input-block">
        <TextArea
          id={`${questionId}-text`}
          name={controlName}
          required={required}
          invalid={Boolean(error)}
          placeholder={textPlaceholder}
          aria-labelledby={headingId}
          aria-describedby={describedBy}
          {...textValueProps}
        />
      </div>
    );
  };

  const renderControl = () => {
    if (type === 'multi') return renderChoiceOptions('multi');
    if (type === 'select') return renderSelect();
    if (type === 'text') return renderText();
    return renderChoiceOptions('single');
  };

  return (
    <SurfaceCard
      className={cn('sd-question-page', className)}
      variant="editorial"
      padding="lg"
      aria-labelledby={headingId}
      aria-describedby={describedBy}
      data-sd-container="true"
    >
      <div className="sd-question-page-head">
        {eyebrow ? <p className="sd-eyebrow m-0">{eyebrow}</p> : null}
        {questionTitle ? (
          <h2 id={headingId} className="sd-title m-0">
            {questionTitle}
            {required ? <span aria-hidden="true"> *</span> : null}
          </h2>
        ) : null}
        {description ? (
          <p id={descriptionId} className="sd-copy m-0">
            {description}
          </p>
        ) : null}
        {meta ? <div className="sd-question-meta">{meta}</div> : null}
      </div>

      {error ? (
        <InlineMessage id={errorId} tone="warning" title={errorTitle}>
          {error}
        </InlineMessage>
      ) : null}

      <div className="sd-question-page-body">
        {renderControl()}
        {children}
      </div>

      {help ? (
        <div id={helpId} className="sd-question-help">
          {help}
        </div>
      ) : null}

      {actions ? <div className="sd-question-actions">{actions}</div> : null}
      {footer ? <div className="sd-question-footer">{footer}</div> : null}
    </SurfaceCard>
  );
}
