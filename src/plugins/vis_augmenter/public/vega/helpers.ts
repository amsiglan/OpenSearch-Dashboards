/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import moment from 'moment';
import { cloneDeep, isEmpty, get } from 'lodash';
import {
  OpenSearchDashboardsDatatable,
  OpenSearchDashboardsDatatableColumn,
} from '../../../expressions/public';
import {
  PointInTimeEvent,
  PointInTimeEventsVisLayer,
  VIS_LAYER_COLUMN_TYPE,
  EVENT_COLOR,
} from '../';

const EVENT_MARK_SIZE = 100;
const EVENT_MARK_SIZE_ENLARGED = 140;
const EVENT_MARK_SHAPE = 'triangle-up';
const EVENT_TIMELINE_HEIGHT = 25;

export const enableEventsInConfig = (config: { kibana: {} }) => {
  return {
    ...config,
    kibana: {
      ...config.kibana,
      showEvents: true,
    },
  };
};

// Get the first xaxis field as only 1 setup of X Axis will be supported and
// there won't be support for split series and split chart
export const getXAxisId = (
  dimensions: any,
  columns: OpenSearchDashboardsDatatableColumn[]
): string => {
  return columns.filter((column) => column.name === dimensions.x.label)[0].id;
};

export const isVisLayerColumn = (column: OpenSearchDashboardsDatatableColumn): boolean => {
  return column.meta?.type === VIS_LAYER_COLUMN_TYPE;
};

/**
 * For temporal domain ranges, there is a bug when passing timestamps in vega lite
 * that is still present in the current libraries we are using when developing in a
 * dev env. See https://github.com/vega/vega-lite/issues/6060 for bug details.
 * So, we convert to a vega-lite Date Time object and pass that instead.
 * See https://vega.github.io/vega-lite/docs/datetime.html for details on Date Time.
 */
const convertToDateTimeObj = (timestamp: number): any => {
  const momentObj = moment(timestamp);
  return {
    year: Number(momentObj.format('YYYY')),
    month: momentObj.format('MMMM'),
    date: momentObj.date(),
    hours: momentObj.hours(),
    minutes: momentObj.minutes(),
    seconds: momentObj.seconds(),
    milliseconds: momentObj.milliseconds(),
  };
};

export const generateVisLayerFilterString = (visLayerColumnIds: string[]): string => {
  if (!isEmpty(visLayerColumnIds)) {
    const filterString = visLayerColumnIds.map(
      (visLayerColumnId) => `datum['${visLayerColumnId}'] > 0`
    );
    return filterString.join(' || ');
  } else {
    // if there is no VisLayers to display, then filter out everything by always returning false
    return 'false';
  }
};

/**
 * By default, the source datatable will not include rows with empty data.
 * For handling events that may belong in missing buckets that are not yet
 * created, we need to create them. For more details, see description in
 * https://github.com/opensearch-project/OpenSearch-Dashboards/pull/3145
 *
 * Note that this may add buckets with start/end times out of the chart bounds.
 * This is the current default behavior of histogram aggregations with intervals,
 * in order for the bucket keys to have "clean" timestamp keys (e.g., 1/1 @ 12AM).
 * For more details, see
 * https://opensearch.org/docs/latest/opensearch/bucket-agg/#histogram-date_histogram
 *
 * Also note this is only adding empty buckets at the beginning/end of a table. We are
 * not taking into account missing buckets within source datapoints. Because of this
 * limitation, it is possible that charted events may not be put into the most precise
 * bucket based on their raw event timestamps, if there is missing / sparse source data.
 */
export const addMissingRowsToTableBounds = (
  datatable: OpenSearchDashboardsDatatable,
  dimensions: any
): OpenSearchDashboardsDatatable => {
  const augmentedTable = cloneDeep(datatable);
  const intervalMillis = moment.duration(dimensions.x.params.interval).asMilliseconds();
  const xAxisId = getXAxisId(dimensions, augmentedTable.columns);
  const chartStartTime = new Date(dimensions.x.params.bounds.min).valueOf();
  const chartEndTime = new Date(dimensions.x.params.bounds.max).valueOf();

  if (!isEmpty(augmentedTable.rows)) {
    const dataStartTime = augmentedTable.rows[0][xAxisId] as number;
    const dataEndTime = augmentedTable.rows[augmentedTable.rows.length - 1][xAxisId] as number;

    let curStartTime = dataStartTime;
    while (curStartTime > chartStartTime) {
      curStartTime -= intervalMillis;
      augmentedTable.rows.unshift({
        [xAxisId]: curStartTime,
      });
    }

    let curEndTime = dataEndTime;
    while (curEndTime < chartEndTime) {
      curEndTime += intervalMillis;
      augmentedTable.rows.push({
        [xAxisId]: curEndTime,
      });
    }
  } else {
    // if there's no existing rows, create them all
    let curTime = chartStartTime;
    while (curTime <= chartEndTime) {
      augmentedTable.rows.push({
        [xAxisId]: curTime,
      });
      curTime += intervalMillis;
    }
  }
  return augmentedTable;
};

/**
 * Adding events into the correct x-axis key (the time bucket)
 * based on the table. As of now only results from
 * PoinInTimeEventsVisLayers are supported
 */
export const addPointInTimeEventsLayersToTable = (
  datatable: OpenSearchDashboardsDatatable,
  dimensions: any,
  visLayers: PointInTimeEventsVisLayer[]
): OpenSearchDashboardsDatatable => {
  const augmentedTable = addMissingRowsToTableBounds(datatable, dimensions);
  const xAxisId = getXAxisId(dimensions, augmentedTable.columns);

  if (!isEmpty(visLayers)) {
    visLayers.every((visLayer: PointInTimeEventsVisLayer) => {
      const visLayerColumnId = `${visLayer.pluginResource.id}`;
      const visLayerColumnName = `${visLayer.pluginResource.name}`;
      augmentedTable.columns.push({
        id: visLayerColumnId,
        name: visLayerColumnName,
        meta: {
          type: VIS_LAYER_COLUMN_TYPE,
        },
      });

      // special case: no rows
      if (augmentedTable.rows.length === 0) {
        return false;
      }

      // special case: only one row - put all timestamps for this annotation
      // in the one bucket and move on to the next layer
      if (augmentedTable.rows.length === 1) {
        augmentedTable.rows[0] = {
          ...augmentedTable.rows[0],
          [visLayerColumnId]: visLayer.events.length,
        };
        return false;
      }

      // Bin the timestamps to the closest x-axis key, adding
      // an entry for this vis layer ID. Sorting the timestamps first
      // so that we will only search a particular row value once, giving us
      // O(n) time complexity where n = number of rows
      // There could be some optimizations, such as binary search + dynamically
      // changing the bounds, but performance benefits would be very minimal
      // if any, given the upper bounds limit on n already due to chart constraints.
      let rowIndex = 0;
      const sortedTimestamps = visLayer.events
        .map((event: PointInTimeEvent) => event.timestamp)
        .sort((n1: number, n2: number) => n1 - n2) as number[];

      if (sortedTimestamps.length > 0) {
        sortedTimestamps.forEach((timestamp) => {
          while (rowIndex < augmentedTable.rows.length - 1) {
            const smallerVal = augmentedTable.rows[rowIndex][xAxisId] as number;
            const higherVal = augmentedTable.rows[rowIndex + 1][xAxisId] as number;
            let rowIndexToInsert: number;

            // timestamp is on the left bounds of the chart
            if (timestamp <= smallerVal) {
              rowIndexToInsert = rowIndex;

              // timestamp is in between the right 2 buckets. now need to determine which one it is closer to
            } else if (timestamp <= higherVal) {
              const smallerValDiff = Math.abs(timestamp - smallerVal);
              const higherValDiff = Math.abs(timestamp - higherVal);
              rowIndexToInsert = smallerValDiff <= higherValDiff ? rowIndex : rowIndex + 1;
            }

            // timestamp is on the right bounds of the chart
            else if (rowIndex + 1 === augmentedTable.rows.length - 1) {
              rowIndexToInsert = rowIndex + 1;
              // timestamp is still too small; traverse to next bucket
            } else {
              rowIndex += 1;
              continue;
            }

            // inserting the value. increment if the mapping/property already exists
            augmentedTable.rows[rowIndexToInsert][visLayerColumnId] =
              (get(augmentedTable.rows[rowIndexToInsert], visLayerColumnId, 0) as number) + 1;
            break;
          }
        });
      }
      return true;
    });
  }
  return augmentedTable;
};

/**
 * Updating the vega lite spec to include layers and marks related to
 * PointInTimeEventsVisLayers. It is assumed the datatable has already been
 * augmented with columns and row data containing the vis layers.
 */
export const addPointInTimeEventsLayersToSpec = (
  datatable: OpenSearchDashboardsDatatable,
  dimensions: any,
  spec: object
): object => {
  const newSpec = cloneDeep(spec) as any;
  newSpec.config = enableEventsInConfig(newSpec.config);

  const xAxisId = getXAxisId(dimensions, datatable.columns);
  const xAxisTitle = dimensions.x.label.replaceAll('"', '');
  const bucketStartTime = convertToDateTimeObj(datatable.rows[0][xAxisId] as number);
  const bucketEndTime = convertToDateTimeObj(
    datatable.rows[datatable.rows.length - 1][xAxisId] as number
  );
  const visLayerColumns = datatable.columns.filter((column: OpenSearchDashboardsDatatableColumn) =>
    isVisLayerColumn(column)
  );
  const visLayerColumnIds = visLayerColumns.map((column) => column.id);
  const hoverParamName = 'hover';

  // Hide x axes text on existing chart so they are only visible on the event chart
  newSpec.layer.forEach((dataSeries: any) => {
    if (get(dataSeries, 'encoding.x.axis', null) !== null) {
      dataSeries.encoding.x.axis = {
        ...dataSeries.encoding.x.axis,
        labels: false,
        title: null,
      };
    }
  });

  // Add a rule to the existing layer for showing lines on the chart if a dot is hovered on
  newSpec.layer.push({
    mark: {
      type: 'rule',
      color: EVENT_COLOR,
      opacity: 1,
    },
    transform: [{ filter: generateVisLayerFilterString(visLayerColumnIds) }],
    encoding: {
      x: {
        field: xAxisId,
        type: 'temporal',
      },
      opacity: {
        value: 0,
        condition: { empty: false, param: hoverParamName, value: 1 },
      },
    },
  });

  // Nesting layer into a vconcat field so we can append event chart.
  newSpec.vconcat = [] as any[];
  newSpec.vconcat.push({
    layer: newSpec.layer,
  });
  delete newSpec.layer;

  // Adding the event timeline chart
  newSpec.vconcat.push({
    height: EVENT_TIMELINE_HEIGHT,
    mark: {
      type: 'point',
      shape: EVENT_MARK_SHAPE,
      color: EVENT_COLOR,
      filled: true,
      opacity: 1,
    },
    transform: [{ filter: generateVisLayerFilterString(visLayerColumnIds) }],
    params: [{ name: hoverParamName, select: { type: 'point', on: 'mouseover' } }],
    encoding: {
      x: {
        axis: {
          title: xAxisTitle,
          grid: false,
          ticks: true,
          orient: 'bottom',
          domain: true,
        },
        field: xAxisId,
        type: 'temporal',
        scale: {
          domain: [bucketStartTime, bucketEndTime],
        },
      },
      size: {
        condition: { empty: false, param: hoverParamName, value: EVENT_MARK_SIZE_ENLARGED },
        value: EVENT_MARK_SIZE,
      },
    },
  });

  return newSpec;
};
