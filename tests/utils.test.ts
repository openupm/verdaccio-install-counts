// Unit tests for utils.ts
import { InvalidDateRangeError } from '../src/constants';
import { getEpochTimeForUTCMidnight, parseVersionFromTarballFilename, getWeekRange, parsePeriod, parseUTCDateString, shiftToUTCMidnight, shiftToUTCMidnightMinusOneMillisecond, parsePackageNameFromTarball, fillMissingDates } from '../src/utils';

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

describe('parseVersionFromTarballFilename', () => {
  it('should return the version number from the tarball name', () => {
    const name = 'test-package-1.0.0.tgz';
    const result = parseVersionFromTarballFilename(name);
    expect(result).toEqual('1.0.0');
  });

  it('should return undefined if the tarball name does not contain a version number', () => {
    const name = 'test-package.tgz';
    const result = parseVersionFromTarballFilename(name);
    expect(result).toBeUndefined();
  });

  it('should return undefined if the tarball name is not in the correct format', () => {
    const name = 'test-package-1.0.0.zip';
    const result = parseVersionFromTarballFilename(name);
    expect(result).toBeUndefined();
  });

  it('should return the version number from the tarball name with preview version', () => {
    const name = 'com.de-panther.webxr-interactions-0.12.0-preview.tgz';
    const result = parseVersionFromTarballFilename(name);
    expect(result).toEqual('0.12.0-preview');
  });

  it('should return undefined from the tarball name with invalid version', () => {
    const name = 'com.de-panther.webxr-interactions-0.12.0.1.tgz';
    const result = parseVersionFromTarballFilename(name);
    expect(result).toBeUndefined();
  });
});

describe('parsePackageNameFromTarball', () => {
  it('should return the package name from the tarball name', () => {
    const name = 'test-package-1.0.0.tgz';
    const result = parsePackageNameFromTarball(name);
    expect(result).toEqual('test-package');
  });

  it('should return the package name from the tarball name with multiple hyphens', () => {
    const name = 'test-package-name-1.0.0.tgz';
    const result = parsePackageNameFromTarball(name);
    expect(result).toEqual('test-package-name');
  });

  it('should return undefined from the tarball name with no version number', () => {
    const name = 'test-package.tgz';
    const result = parsePackageNameFromTarball(name);
    expect(result).toBeUndefined();
  });
});

describe('fillMissingDates', () => {
  it('should fill in missing dates with a downloads value of 0', () => {
    const input = [
      { day: '2023-05-26', downloads: 5 },
      { day: '2023-05-28', downloads: 1 },
    ];
    const expectedOutput = [
      { day: '2023-05-26', downloads: 5 },
      { day: '2023-05-27', downloads: 0 },
      { day: '2023-05-28', downloads: 1 },
    ];
    const output = fillMissingDates(input);
    expect(output).toEqual(expectedOutput);
  });

  it('should handle an empty input list', () => {
    const input = [];
    const expectedOutput = [];
    const output = fillMissingDates(input);
    expect(output).toEqual(expectedOutput);
  });

  it('should handle a single-item input list', () => {
    const input = [{ day: '2023-05-26', downloads: 5 }];
    const expectedOutput = [{ day: '2023-05-26', downloads: 5 }];
    const output = fillMissingDates(input);
    expect(output).toEqual(expectedOutput);
  });

  it('should handle a list with no missing dates', () => {
    const input = [
      { day: '2023-05-26', downloads: 5 },
      { day: '2023-05-27', downloads: 3 },
      { day: '2023-05-28', downloads: 1 },
    ];
    const expectedOutput = [
      { day: '2023-05-26', downloads: 5 },
      { day: '2023-05-27', downloads: 3 },
      { day: '2023-05-28', downloads: 1 },
    ];
    const output = fillMissingDates(input);
    expect(output).toEqual(expectedOutput);
  });

  it('should handle a list with all missing dates', () => {
    const input = [
      { day: '2023-05-26', downloads: 5 },
      { day: '2023-05-28', downloads: 1 },
      { day: '2023-05-31', downloads: 1 },
    ];
    const expectedOutput = [
      { day: '2023-05-26', downloads: 5 },
      { day: '2023-05-27', downloads: 0 },
      { day: '2023-05-28', downloads: 1 },
      { day: '2023-05-29', downloads: 0 },
      { day: '2023-05-30', downloads: 0 },
      { day: '2023-05-31', downloads: 1 },
    ];
    const output = fillMissingDates(input);
    expect(output).toEqual(expectedOutput);
  });

  it('should handle a list with specified startDate and endDate', () => {
    const input = [
      { day: '2023-05-28', downloads: 1 },
    ];
    const expectedOutput = [
      { day: '2023-05-26', downloads: 0 },
      { day: '2023-05-27', downloads: 0 },
      { day: '2023-05-28', downloads: 1 },
      { day: '2023-05-29', downloads: 0 },
      { day: '2023-05-30', downloads: 0 },
      { day: '2023-05-31', downloads: 0 },
    ];
    const output = fillMissingDates(input, new Date('2023-05-26'), new Date('2023-05-31'));
    expect(output).toEqual(expectedOutput);
  });
});