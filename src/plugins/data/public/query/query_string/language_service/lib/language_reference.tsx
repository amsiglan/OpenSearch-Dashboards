/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { i18n } from '@osd/i18n';

import { EuiButtonIcon, EuiPopover, EuiPopoverTitle } from '@elastic/eui';

import React, { ReactFragment } from 'react';
import { FormattedMessage } from 'react-intl';

export const LanguageReference = (props: { body: ReactFragment }) => {
  const [isLanguageReferenceOpen, setIsLanguageReferenceOpen] = React.useState(false);

  const button = (
    <div>
      <EuiButtonIcon
        iconType={'iInCircle'}
        aria-label={i18n.translate('data.queryControls.languageReference', {
          defaultMessage: `Language Reference`,
        })}
        onClick={() => setIsLanguageReferenceOpen(!isLanguageReferenceOpen)}
      />
    </div>
  );

  return (
    <EuiPopover
      id="languageReferencePopover"
      button={button}
      isOpen={isLanguageReferenceOpen}
      closePopover={() => setIsLanguageReferenceOpen(false)}
      panelPaddingSize="s"
      anchorPosition="downLeft"
      anchorClassName="euiFormControlLayout__append"
    >
      <EuiPopoverTitle>
        <FormattedMessage
          id="data.query.queryBar.syntaxOptionsTitle"
          defaultMessage="Syntax options"
        />
      </EuiPopoverTitle>
      <div style={{ width: '350px' }}>{props.body}</div>
    </EuiPopover>
  );
};
