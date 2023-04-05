/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { get } from 'lodash';
import { EuiFlexGroup, EuiFlexItem, EuiSpacer, EuiLink, EuiNotificationBadge } from '@elastic/eui';
import { getEmbeddable, getCore } from '../../services';
import './styles.scss';
import { EventVisEmbeddableItem } from '.';
import { VisLayerTypes } from '../../';

interface Props {
  item: EventVisEmbeddableItem;
}

export function EventVisItem(props: Props) {
  const PanelComponent = getEmbeddable().getEmbeddablePanel();
  const baseUrl = getCore().http.basePath;
  const { name, urlPath } = props.item.visLayer.pluginResource;

  // For now we only support PointInTimeEventsVisLayers. Ensure that check here,
  // and if so, set the event count to the length of the events
  const showEventCount = props.item.visLayer.type === VisLayerTypes.PointInTimeEvents;
  let eventCount;
  if (showEventCount) {
    eventCount = get(props.item.visLayer, 'events.length', 0);
  }

  return (
    <>
      <EuiSpacer size="l" />
      <EuiFlexGroup direction="row" gutterSize="s">
        <EuiFlexItem
          grow={false}
          className="view-events-flyout__visDescription"
          data-test-subj="pluginResourceDescription"
        >
          <EuiFlexGroup alignItems="center">
            <EuiFlexItem>
              <EuiLink href={`${baseUrl.prepend(`${urlPath}`)}`}>{name}</EuiLink>
            </EuiFlexItem>
            {showEventCount ? (
              <EuiFlexItem grow={false} data-test-subj="eventCount">
                <EuiNotificationBadge color="subdued">{eventCount}</EuiNotificationBadge>
              </EuiFlexItem>
            ) : null}
          </EuiFlexGroup>
        </EuiFlexItem>

        <EuiFlexItem grow={true} className="view-events-flyout__eventVis" data-test-subj="eventVis">
          <PanelComponent
            embeddable={props.item.embeddable}
            hideHeader={true}
            hasBorder={false}
            hasShadow={false}
          />
        </EuiFlexItem>
      </EuiFlexGroup>
    </>
  );
}
