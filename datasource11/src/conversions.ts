import Qty from 'js-quantities';

const CONVERSIONS = {
  'm/s': {
    kn: Qty.swiftConverter('m/s', 'kn'),
    'km/h': Qty.swiftConverter('m/s', 'km/h'),
  },
  kg: {
    pound: Qty.swiftConverter('kg', 'pound'),
    'metric ton': Qty.swiftConverter('kg', 'metric-ton'),
  },
  m3: {
    liter: Qty.swiftConverter('m^3', 'liter'),
    gallon: Qty.swiftConverter('m^3', 'gallon'),
    'gallon (imp)': Qty.swiftConverter('m^3', 'gallon-imp'),
  },
  'm3/s': {
    'l/min': Qty.swiftConverter('m^3/s', 'liter/minute'),
    'l/h': Qty.swiftConverter('m^3/s', 'liter/hour'),
    'g/min': Qty.swiftConverter('m^3/s', 'gallon/minute'),
    'g/h': Qty.swiftConverter('m^3/s', 'gallon/hour'),
  },
  K: {
    '°C': Qty.swiftConverter('tempK', 'tempC'),
    '°F': Qty.swiftConverter('tempK', 'tempF'),
  },
  Hz: {
    '1/min': function (hz: number) {
      return hz * 60;
    },
    rpm: function (hz: number) {
      return hz * 60;
    },
    '10/min': function (hz: number) {
      return (hz * 60) / 10;
    },
    '100/min': function (hz: number) {
      return (hz * 60) / 100;
    },
    rpmX100: function (hz: number) {
      return (hz * 60) / 100;
    },
    '1000/min': function (hz: number) {
      return (hz * 60) / 1000;
    },
    rpmX1000: function (hz: number) {
      return (hz * 60) / 1000;
    },
  },
  m: {
    fathom: Qty.swiftConverter('m', 'fathom'),
    feet: Qty.swiftConverter('m', 'foot'),
    km: Qty.swiftConverter('m', 'km'),
    nm: Qty.swiftConverter('m', 'nmi'),
  },
  Pa: {
    hPa: Qty.swiftConverter('pascal', 'hPa'),
    bar: Qty.swiftConverter('pascal', 'bar'),
    mbar: Qty.swiftConverter('pascal', 'millibar'),
    psi: Qty.swiftConverter('pascal', 'psi'),
    mmHg: Qty.swiftConverter('pascal', 'mmHg'),
    inHg: Qty.swiftConverter('pascal', 'inHg'),
  },
  s: {
    minutes: Qty.swiftConverter('s', 'minutes'),
    hours: Qty.swiftConverter('s', 'hours'),
    days: Qty.swiftConverter('s', 'days'),
  },
  'rad/s': {
    'deg/s': Qty.swiftConverter('rad/s', 'deg/s'),
    'deg/min': Qty.swiftConverter('rad/s', 'deg/min'),
  },
  ratio: {
    '%': function (ratio: number) {
      return ratio * 100;
    },
  },
  rad: {
    deg: Qty.swiftConverter('rad', 'deg'),
  },
  C: {
    Ah: Qty.swiftConverter('coulomb', 'Ah'),
  },
  J: {
    Wh: Qty.swiftConverter('joule', 'Wh'),
    BTU: Qty.swiftConverter('joule', 'btu'),
  },
} as {
  [key: Unit]: {
    [key: Unit]: any;
  };
};

type Brand<K, T> = K & { __brand: T };

export type Unit = Brand<string, 'unit'>;

export const getTargetUnits = (from: Unit): Unit[] => {
  if (CONVERSIONS[from]) {
    return Object.keys(CONVERSIONS[from]) as Unit[];
  }
  return [];
};

export interface UnitConversion {
  from: Unit,
  to: Unit
}

export const getConverter = ({from, to}: UnitConversion) => {
  if (CONVERSIONS[from][to]) {
    return CONVERSIONS[from][to]
  }
  console.error(`No conversion from ${from} to ${to}`)
  return (x: any) => x
}
