import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Chart, registerInteraction } from '@antv/g2';
import { ChartCfg } from '@antv/g2/lib/interface';
import dayjs from 'dayjs';
import { VALUE_TYPE } from '@/utils/promQL';
import { LINE_CHART_COLORS } from '@/utils/chart/chart';
import { getProperByteDesc } from '@/utils/dashboard';
import { ServiceName } from '@/utils/interface';

export interface IProps {
  renderChart: (chartInstance: Chart) => void;
  options?: Partial<ChartCfg>;
}

function LineChart(props: IProps, ref) {
  const { options = {}, renderChart } = props;

  const chartRef = useRef<any>();

  const yMin = useRef<number>(0);
  const yMax = useRef<number>(100);

  const chartInstanceRef = useRef<Chart>();

  const renderChartContent = () => {
    if (!chartRef.current) return;
    chartInstanceRef.current = new Chart({
      container: chartRef.current,
      autoFit: true,
      padding: [20, 20, 60, 50],
      ...options,
    });
    registerInteraction('brush', {
      showEnable: [
        { trigger: 'plot:mouseenter', action: 'cursor:crosshair' },
        { trigger: 'plot:mouseleave', action: 'cursor:default' },
      ],
      start: [
        {
          trigger: 'plot:mousedown',
          action: ['brush-x:start', 'rect-mask:start', 'rect-mask:show'],
        },
      ],
      processing: [
        {
          trigger: 'plot:mousemove',
          action: ['rect-mask:resize'],
        },
      ],
      end: [
        {
          trigger: 'plot:mouseup',
          action: ['brush-x:filter', 'brush:end', 'rect-mask:end', 'rect-mask:hide', 'reset-button:show'],
        },
      ],
      rollback: [{ trigger: 'reset-button:click', action: ['brush:reset', 'reset-button:hide'] }],
    });
    chartInstanceRef.current.interaction('brush');
    showScaleByBaseLine();
    chartInstanceRef.current.interaction('brush');
    renderChart(chartInstanceRef.current);
    chartInstanceRef.current.render();
  };

  useEffect(() => {
    renderChartContent();
  }, []);

  useEffect(() => {
    updateChart();
  }, [options])

  useImperativeHandle(ref, () => ({
    updateBaseline: (baseLine) => {
      updateChart(baseLine);
    },
    updateDetailChart,
    configDetailChart,
    autoAdjustPadding,
    changeData,
  }));

  const autoAdjustPadding = (type: VALUE_TYPE) => {
    if (!chartInstanceRef.current) return;
    const max = yMax.current;
    const min = yMin.current;
    const mid = ((max + min) / 2).toFixed(2);
    let leftOffset = 0;
    if (type === VALUE_TYPE.byte) {
      const { desc } = getProperByteDesc(Number(mid));
      leftOffset = desc === '0' ? 36 : (desc.length) * 12;
    } else if (type === VALUE_TYPE.byteSecond || type == VALUE_TYPE.byteSecondNet) {
      const { desc } = getProperByteDesc(Number(mid));
      leftOffset = desc === '0' ? 36 : (desc.length) * 12;
    } else if (type = VALUE_TYPE.number) {
      leftOffset = (mid.toString().length) * 8;
    } else {
      leftOffset = (mid.toString().length + 2) * 10;
    }
    if (options?.padding) {
      options.padding[3] = leftOffset;
    }
    chartInstanceRef.current.padding = options.padding as any;
    chartInstanceRef.current.render(true);
  }

  const calcScaleOption = (max: number = 100, min: number = 0) => {
    if ((max - min) < 5) {
      max = max + 5;
      min = min - 5;
    }
    yMin.current = min;
    yMax.current = max;
    return {
      min: yMin.current,
      max: yMax.current,
      tickInterval: Math.round((max - min) / 5),
    }
  }

  const changeData = (data) => {
    if (!chartInstanceRef.current) return;
    chartInstanceRef.current.changeData(data);
  };

  const configDetailChart = (
    options: {
      tickInterval?: number;
      sizes?: any;
      valueType?: VALUE_TYPE;
      isCard?: boolean;
      maxNum?: number;
    }
  ) => {
    if (!chartInstanceRef.current) return;
    chartInstanceRef.current
      .axis('time', {
        label: {
          formatter: time => dayjs(Number(time) * 1000).format('HH:mm'),
        },
        grid: options.isCard
          ? null
          : {
            line: {
              type: 'line',
              style: {
                fill: '#d9d9d9',
                opacity: 0.5,
              },
            },
          },
      })
      .legend({
        position: 'bottom',
      })
      .scale({
        time: {
          tickInterval: options.tickInterval,
        },
        temperature: {
          nice: true,
        },
      })
      .line()
      .position('time*value')
      .color('type', LINE_CHART_COLORS);

    const tooltipTitle = time =>
      dayjs(Number(time) * 1000).format('YYYY-MM-DD HH:mm:ss');

    switch (options.valueType) {
      case VALUE_TYPE.percentage:
        chartInstanceRef.current.axis('value', {
          label: {
            formatter: percent => `${percent}%`,
          },
        });
        chartInstanceRef.current.tooltip({
          customItems: items =>
            items.map(item => {
              const value = `${Number(item.value).toFixed(2)}%`;
              return {
                ...item,
                value,
              };
            }),
          showCrosshairs: true,
          shared: true,
          title: tooltipTitle,
        });
        chartInstanceRef.current.scale({
          value: {
            min: 0,
            max: options.maxNum || 100,
            tickInterval: options.maxNum ? (options.maxNum % 10 + 10) / 5 : 25,
          },
        });
        break;
      case VALUE_TYPE.byte:
      case VALUE_TYPE.byteSecond:
        chartInstanceRef.current.axis('value', {
          label: {
            formatter: bytes => {
              const { value, unit } = getProperByteDesc(Number(bytes));
              let _unit = unit;
              if (options.valueType === VALUE_TYPE.byteSecond) {
                _unit = `${unit}/s`;
              }

              return `${value} ${_unit}`;
            },
          },
        });
        chartInstanceRef.current.tooltip({
          customItems: items =>
            items.map(item => {
              const { value, unit } = getProperByteDesc(Number(item.value));
              let _unit = unit;
              if (options.valueType === VALUE_TYPE.byteSecond) {
                _unit = `${unit}/s`;
              }
              return {
                ...item,
                value: `${value} ${_unit}`,
              };
            }),
          showCrosshairs: true,
          shared: true,
          title: tooltipTitle,
        });
        break;
      case VALUE_TYPE.byteSecondNet:
        chartInstanceRef.current.axis('value', {
          label: {
            formatter: bytes => {
              const { value, unit } = getProperByteDesc(Number(bytes));
              const _unit = `${unit}/s`;
              return `${value} ${_unit}`;
            },
          },
        });
        chartInstanceRef.current.tooltip({
          customItems: items =>
            items.map(item => {
              const { value, unit } = getProperByteDesc(Number(item.value));
              const _unit = `${unit}/s`;
              return {
                ...item,
                value: `${value} ${_unit}`,
              };
            }),
          showCrosshairs: true,
          shared: true,
          title: tooltipTitle,
        });
        break;
      case VALUE_TYPE.number:
      case VALUE_TYPE.numberSecond:
        chartInstanceRef.current.axis('value', {
          label: {
            formatter: processNum => {
              if (options.valueType === VALUE_TYPE.numberSecond) {
                return `${processNum}/s`;
              }
              return processNum;
            },
          },
        });
        chartInstanceRef.current.tooltip({
          customItems: items =>
            items.map(item => {
              let value = item.value;
              if (options.valueType === VALUE_TYPE.numberSecond) {
                value = `${value}/s`;
              }
              return {
                ...item,
                value,
              };
            }),
          showCrosshairs: true,
          shared: true,
          title: tooltipTitle,
        });
        break;
      default:
    }
    // autoAdjustPadding(options.valueType!);
    return chartInstanceRef.current;
  };

  const updateDetailChart = (
    options: {
      type?: ServiceName;
      tickInterval: number;
      valueType: VALUE_TYPE;
      statSizes?: any;
      maxNum?: number;
      minNum?: number;
    },
  ) => {
    if (!chartInstanceRef.current) return;
    chartInstanceRef.current.scale({
      time: {
        tickInterval: options.tickInterval,
      },
    });
    const { maxNum, minNum } = options
    const { min, max, tickInterval } = calcScaleOption(maxNum, minNum);
    chartInstanceRef.current.scale({
      value: {
        min,
        max,
        tickInterval,
      },
    });
    autoAdjustPadding(options.valueType);
    return chartInstanceRef.current;
  };

  const showScaleByBaseLine = (curbaseLine?) => {
    if (!chartInstanceRef.current) return;
    let baseLine = curbaseLine;
    if (baseLine) {
      if (baseLine >= yMax.current) {
        const val = Math.round(baseLine + (yMax.current - yMin.current) / 5);
        chartInstanceRef.current?.scale('value', {
          min: yMin.current,
          max: Math.round(val),
          ticks: [yMin.current, baseLine, Math.round(val)],
        });
      } else if (baseLine <= yMin.current) {
        const val = Math.round(baseLine - (yMax.current - yMin.current) / 5);
        chartInstanceRef.current?.scale('value', {
          min: Math.round(val),
          max: yMax.current,
          ticks: [Math.round(val), baseLine, yMax.current],
        });
      }
    }
  };

  const updateChart = (curbaseLine?) => {
    let baseLine = curbaseLine
    if (!chartInstanceRef.current) return;
    if (baseLine !== undefined) {
      chartInstanceRef.current?.annotation().clear(true);
      chartInstanceRef.current?.annotation().line({
        start: ['min', baseLine],
        end: ['max', baseLine],
        style: {
          stroke: '#e6522b',
          lineWidth: 1,
          lineDash: [3, 3],
          zIndex: 999,
        },
      });
      showScaleByBaseLine(baseLine);
    }
    // HACK: updateOptions not work, https://github.com/antvis/G2/issues/2844
    if (options) {
      chartInstanceRef.current.padding = options.padding as any;
    }
    // HACK: G2 Chart autoFit don't take effect , refer: https://github.com/antvis/g2/commit/92d607ec5408d1ec949ebd95209c84b04c73b944, but not work
    if (chartInstanceRef.current.height < 100) {
      const e = document.createEvent('Event');
      e.initEvent('resize', true, true);
      window.dispatchEvent(e);
    }
    if (chartRef.current) {
      chartInstanceRef.current.changeSize(chartRef.current.clientWidth, chartRef.current.clientHeight);
    }
    chartInstanceRef.current!.render(true);
  };

  return (
    <div className="nebula-chart nebula-chart-line" ref={ref => chartRef.current = ref} />
  );
}

export default forwardRef(LineChart);
