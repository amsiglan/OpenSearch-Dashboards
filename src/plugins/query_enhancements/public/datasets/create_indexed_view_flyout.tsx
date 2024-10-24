/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import './create_indexed_view_flyout.scss';
import React, { useState } from 'react';
import {
  EuiAccordion,
  EuiButton,
  EuiButtonEmpty,
  EuiCallOut,
  EuiCodeBlock,
  EuiDatePicker,
  EuiDatePickerRange,
  EuiFieldNumber,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiFlyoutHeader,
  EuiFormRow,
  EuiSelect,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from '@elastic/eui';
import { i18n } from '@osd/i18n';
import { FormattedMessage } from '@osd/i18n/react';
import moment, { Moment } from 'moment';
import { IDataPluginServices, IndexedViewsService } from '../../../data/public';
// import { IndexedViewsListProps } from '../../../data/public';
// import { IndexedViewsEntryPoint } from './indexed_views_entrypoint';

export interface CreateIndexedViewParams {
  name: string;
  query: string;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface CreateIndexedViewFlyoutProps {
  onClose: () => void;
  onSubmit: (params: CreateIndexedViewParams) => Promise<void>;
  services?: IDataPluginServices;
}

export const indexedViewsService: IndexedViewsService = {
  getIndexedViews: () => {
    return Promise.resolve([]);
  },
  // getIndexViewsEntryPoint: () => ({ services, selectedDataset }: IndexedViewsListProps) => (
  //   <IndexedViewsEntryPoint services={services} selectedDataset={selectedDataset} />
  // ),
};

export const getLoadingCalloutContent = (showCreateIndexedViewFlyout: () => void) => (
  <>
    <p>
      {i18n.translate('queryEnhancements.datasets.createIndexedViewCalloutContent', {
        defaultMessage: 'You can further accelerate query response times by indexing your data.',
      })}
    </p>
    <EuiButton onClick={showCreateIndexedViewFlyout}>Create indexed view</EuiButton>
  </>
);

export const CreateIndexedViewFlyout = ({
  services,
  onClose,
  onSubmit,
}: CreateIndexedViewFlyoutProps) => {
  const q = services?.data.query.queryString.getQuery();
  const [name, setName] = useState<string>('');
  const [startDate, setStartDate] = useState<Moment>(moment().subtract(1, 'day'));
  const [endDate, setEndDate] = useState<Moment>(moment());
  const [updateFrequency, setUpdateFrequency] = useState({ period: 15, unit: 'Minutes' });
  const [isCreationInProgress, setIsCreationInProgress] = useState(false);

  return (
    <EuiFlyout onClose={onClose}>
      <EuiFlyoutHeader hasBorder>
        <EuiTitle>
          <h3>Index data</h3>
        </EuiTitle>
        <EuiText color="subdued">
          <p>
            {i18n.translate('queryEnhancements.datasets.createIndexedViewFlyoutHeaderSubTitle', {
              defaultMessage: 'Improve query performance by indexing relevant data for this query.',
            })}
          </p>
        </EuiText>
      </EuiFlyoutHeader>
      <EuiFlyoutBody className="createIndexedView__flyoutBody">
        <EuiFlexGroup
          direction="column"
          justifyContent="spaceBetween"
          gutterSize="none"
          style={{ height: '100%' }}
        >
          <EuiFlexItem grow={9}>
            <EuiFormRow
              fullWidth
              label={i18n.translate('queryEnhancements.createIndexedView.QueryLabel', {
                defaultMessage: 'Index data from',
              })}
            >
              <EuiCodeBlock lang={q?.language}>{q?.query || ''}</EuiCodeBlock>
            </EuiFormRow>
            <EuiFormRow
              fullWidth
              label={i18n.translate('queryEnhancements.createIndexedView.NameLabel', {
                defaultMessage: 'Index name',
              })}
            >
              <EuiFieldText fullWidth value={name} onChange={(e) => setName(e.target.value)} />
            </EuiFormRow>
            <EuiFormRow
              fullWidth
              label={i18n.translate('queryEnhancements.createIndexedView.TimeRangeLabel', {
                defaultMessage: 'Time range',
              })}
            >
              <EuiDatePickerRange
                fullWidth
                startDateControl={
                  <EuiDatePicker
                    selected={startDate}
                    onChange={(date) => {
                      if (date) {
                        setStartDate(date);
                      }
                    }}
                    startDate={startDate}
                    endDate={endDate}
                    isInvalid={startDate > endDate}
                    aria-label="Start date"
                    showTimeSelect
                  />
                }
                endDateControl={
                  <EuiDatePicker
                    selected={endDate}
                    onChange={(date) => {
                      if (date) {
                        setEndDate(date);
                      }
                    }}
                    startDate={startDate}
                    endDate={endDate}
                    isInvalid={startDate > endDate}
                    aria-label="End date"
                    showTimeSelect
                  />
                }
              />
            </EuiFormRow>
            <EuiSpacer />
            <EuiAccordion
              id="create-indexed-view-advanced-settings"
              buttonContent="Advanced settings"
              paddingSize="l"
            >
              <EuiFormRow
                label={i18n.translate('queryEnhancements.createIndexedView.UpdateFreqLabel', {
                  defaultMessage: 'Update frequency',
                })}
                helpText={i18n.translate('queryEnhancements.createIndexedView.UpdateFreqHelpText', {
                  defaultMessage: 'Specify how frequent new data gets ingested.',
                })}
              >
                <EuiFlexGroup>
                  <EuiFlexItem>
                    <EuiFieldNumber
                      value={updateFrequency.period}
                      onChange={(e) => {
                        setUpdateFrequency({
                          ...updateFrequency,
                          period: Number.parseInt(e.target.value, 10),
                        });
                      }}
                      min={1}
                    />
                  </EuiFlexItem>
                  <EuiFlexItem>
                    <EuiSelect
                      options={['Minutes', 'Hrs', 'Days'].map((unit) => ({
                        text: unit,
                        value: unit,
                      }))}
                      value={updateFrequency.unit}
                      onChange={(e) => {
                        setUpdateFrequency({
                          ...updateFrequency,
                          unit: e.target.value,
                        });
                      }}
                      hasNoInitialSelection
                    />
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiFormRow>
            </EuiAccordion>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiCallOut
              title={
                <FormattedMessage
                  id="queryEnhancements.indexedViewFlyout.create.callout.title"
                  defaultMessage="Indexed views may take some time to initialize"
                />
              }
              iconType={'iInCircle'}
            >
              <EuiText>
                <span>
                  It is recommended to scope down the data needed for the indexed view to improve
                  performance and efficiency. Larger data sets will take longer to initialize. 
                </span>
              </EuiText>
            </EuiCallOut>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlyoutBody>
      <EuiFlyoutFooter>
        <EuiFlexGroup justifyContent="spaceBetween">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty
              onClick={onClose}
              size="s"
              iconType="cross"
              iconSide="left"
              data-test-subj="createIndexedViewCancelBtn"
            >
              <FormattedMessage
                id="queryEnhancements.indexedViewFlyout.create.cancelButtonLabel"
                defaultMessage="Cancel"
              />
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              // disabled={!file}
              onClick={async () => {
                setIsCreationInProgress(true);
                // await creation to finish
                await onSubmit({
                  name,
                  query: (q?.query as string) || '',
                  dateRange: {
                    start: startDate.toString(),
                    end: endDate.toString(),
                  },
                });
                setIsCreationInProgress(false);
              }}
              size="s"
              fill
              isLoading={isCreationInProgress}
              data-test-subj="createIndexedViewConfirmBtn"
            >
              <FormattedMessage
                id="queryEnhancements.indexedViewFlyout.create.confirmButtonLabel"
                defaultMessage="Create indexed view"
              />
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlyoutFooter>
    </EuiFlyout>
  );
};
