// Unit tests for utils.ts
import { InvalidDateRangeError } from '../src/constants';
import { getEpochTimeForUTCMidnight, getWeekRange, parsePeriod, parseUTCDateString, shiftToUTCMidnight, shiftToUTCMidnightMinusOneMillisecond } from '../src/utils';

describe('getWeekRange', () => {
  // Unit tests for getWeekRange
  it('it returns week range for a group of inputs', () => {
    const inputDate1 = new Date('2020-01-01');
    const expectedRange1 = [new Date('2019-12-30'), new Date('2020-01-05')];

    const inputDate2 = new Date('2023-05-20');
    const expectedRange2 = [new Date('2023-05-15'), new Date('2023-05-21')];

    const inputDate3 = new Date('2022-12-31');
    const expectedRange3 = [new Date('2022-12-26'), new Date('2023-01-01')];

    const [weekStart1, weekEnd1] = getWeekRange(inputDate1);
    expect([weekStart1, weekEnd1]).toEqual(expectedRange1);

    const [weekStart2, weekEnd2] = getWeekRange(inputDate2);
    expect([weekStart2, weekEnd2]).toEqual(expectedRange2);

    const [weekStart3, weekEnd3] = getWeekRange(inputDate3);
    expect([weekStart3, weekEnd3]).toEqual(expectedRange3);
  });
});

describe('getEpochTimeForUTCMidnight', () => {
  it('returns the epoch time for midnight of the given date', () => {
    const date = new Date('2022-12-31T12:34:56Z');
    const epochTime = getEpochTimeForUTCMidnight(date);
    expect(epochTime).toBe(1672444800000);
  });
});

describe('parseUTCDateString', () => {
  it('should parse a valid date string with format yyyy-mm-dd', () => {
    const dateStr = '2022-01-01';
    const expectedDate = new Date(Date.UTC(2022, 0, 1));
    const result = parseUTCDateString(dateStr);
    expect(result).toEqual(expectedDate);
  });

  it('should return NaN for an invalid date string', () => {
    const dateStr = 'invalid date';
    const result = parseUTCDateString(dateStr);
    expect(isNaN(result.getTime())).toBe(true);
  });
});

describe('parsePeriod', () => {
  it('should parse period in the format of YYYY-MM-DD:YYYY-MM-DD', () => {
    const period = '2022-01-01:2022-01-31';
    const [startDate, endDate] = parsePeriod(period);
    expect(startDate.toISOString()).toEqual('2022-01-01T00:00:00.000Z');
    expect(endDate.toISOString()).toEqual('2022-01-31T00:00:00.000Z');
  });

  it('should parse period with equal startDate and endDate in the format of YYYY-MM-DD:YYYY-MM-DD', () => {
    const period = '2022-01-01:2022-01-01';
    const [startDate, endDate] = parsePeriod(period);
    expect(startDate.toISOString()).toEqual('2022-01-01T00:00:00.000Z');
    expect(endDate.toISOString()).toEqual('2022-01-01T00:00:00.000Z');
  });

  it('should throw an error if period is not in the correct format', () => {
    const period = '20220101:20220131';
    expect(() => parsePeriod(period)).toThrowError(InvalidDateRangeError);
  });

  it('should parse period "all-time"', () => {
    const period = 'all-time';
    const [startDate, endDate] = parsePeriod(period);
    expect(startDate.toISOString()).toEqual('1970-01-01T00:00:00.000Z');
    expect(endDate.toISOString()).toEqual(shiftToUTCMidnightMinusOneMillisecond(new Date()).toISOString());
  });

  it('should parse period "last-day"', () => {
    const period = 'last-day';
    const [startDate, endDate] = parsePeriod(period);
    expect(startDate.toISOString()).toEqual(shiftToUTCMidnight(new Date(Date.now() - 24 * 60 * 60 * 1000)).toISOString());
    expect(endDate.toISOString()).toEqual(shiftToUTCMidnightMinusOneMillisecond(new Date()).toISOString());
  });

  it('should parse period "last-week"', () => {
    const period = 'last-week';
    const [startDate, endDate] = parsePeriod(period);
    expect(startDate.toISOString()).toEqual(shiftToUTCMidnight(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).toISOString());
    expect(endDate.toISOString()).toEqual(shiftToUTCMidnightMinusOneMillisecond(new Date()).toISOString());
  });

  it('should parse period "last-month"', () => {
    const period = 'last-month';
    const [startDate, endDate] = parsePeriod(period);
    expect(startDate.toISOString()).toEqual(shiftToUTCMidnight(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString());
    expect(endDate.toISOString()).toEqual(shiftToUTCMidnightMinusOneMillisecond(new Date()).toISOString());
  });
});