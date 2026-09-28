import { describe, expect, it } from 'vitest';
import {
  cleanCompanyName,
  companyFromAboutHeading,
  employmentTypeFromText,
  isListingTitle,
  locationFromText,
  parseSalary,
  splitPageTitle,
  workplaceTypeFromText,
} from './text-signals.js';

describe('parseSalary', () => {
  it.each([
    [
      '$120,000 - $150,000 per year',
      { salaryMin: 120000, salaryMax: 150000, salaryCurrency: 'USD', salaryPeriod: 'year' },
    ],
    [
      '£50k–£60k',
      { salaryMin: 50000, salaryMax: 60000, salaryCurrency: 'GBP', salaryPeriod: 'year' },
    ],
    [
      'USD 136,000.00 - 184,100.00 annually',
      { salaryMin: 136000, salaryMax: 184100, salaryCurrency: 'USD', salaryPeriod: 'year' },
    ],
    [
      '136,000 - 184,100 USD annually',
      { salaryMin: 136000, salaryMax: 184100, salaryCurrency: 'USD', salaryPeriod: 'year' },
    ],
    [
      'Pay: $45 - $55 an hour',
      { salaryMin: 45, salaryMax: 55, salaryCurrency: 'USD', salaryPeriod: 'hour' },
    ],
    [
      '€18 per hour',
      { salaryMin: 18, salaryMax: undefined, salaryCurrency: 'EUR', salaryPeriod: 'hour' },
    ],
    [
      'CAD 90,000 to 110,000',
      { salaryMin: 90000, salaryMax: 110000, salaryCurrency: 'CAD', salaryPeriod: 'year' },
    ],
    [
      '€60.000 - €70.000',
      { salaryMin: 60000, salaryMax: 70000, salaryCurrency: 'EUR', salaryPeriod: 'year' },
    ],
  ])('parses %s', (text, expected) => {
    expect(parseSalary(`Compensation: ${text} plus equity.`)).toEqual(expected);
  });

  it('ignores numbers that are not salaries', () => {
    expect(
      parseSalary('Founded in 2010, we have 500 - 1,000 customers and $3 billion in revenue.'),
    ).toBeUndefined();
    expect(parseSalary('$5 per month subscription')).toBeUndefined();
    expect(parseSalary('Requisition 12345')).toBeUndefined();
  });
});

describe('splitPageTitle', () => {
  it.each([
    ['Senior Engineer - Acme', 'Senior Engineer', 'Acme'],
    ['Senior Engineer | Acme Careers', 'Senior Engineer', 'Acme'],
    ['Senior Engineer at Acme', 'Senior Engineer', 'Acme'],
    ['Senior Engineer at Acme | LinkedIn', 'Senior Engineer', 'Acme'],
    ['Data Analyst - Job ID: 12345 | Amazon.jobs', 'Data Analyst', 'Amazon'],
    [
      'US - Specialist: Seasonal, Part-time - Jobs - Careers at Apple',
      'Specialist: Seasonal, Part-time',
      'Apple',
    ],
    ['Commercial Program Manager — Google Careers', 'Commercial Program Manager', 'Google'],
    ['Head of Design', 'Head of Design', undefined],
    ['Apple - Software Engineer', 'Software Engineer', 'Apple'],
  ])('%s', (pageTitle, title, company) => {
    expect(splitPageTitle(pageTitle)).toEqual({ title, company });
  });

  it('drops a known company from the title', () => {
    expect(splitPageTitle('Acme Inc. | Senior Engineer', 'Acme Inc.')).toEqual({
      title: 'Senior Engineer',
      company: undefined,
    });
  });

  it('does not split on dashes in strict mode', () => {
    expect(splitPageTitle('US - Specialist: Seasonal', undefined, { dashes: false })).toEqual({
      title: 'US - Specialist: Seasonal',
    });
    expect(splitPageTitle('Chef at Le Bistro', undefined, { dashes: false })).toEqual({
      title: 'Chef',
      company: 'Le Bistro',
    });
  });
});

describe('cleanCompanyName', () => {
  it.each([
    ['Amazon.jobs', 'Amazon'],
    ['Careers at Apple', 'Apple'],
    ['Google Careers', 'Google'],
    ['Acme - Jobs', 'Acme'],
    ['Careers', undefined],
    ['LinkedIn', undefined],
  ])('%s -> %s', (name, expected) => {
    expect(cleanCompanyName(name)).toBe(expected);
  });
});

describe('isListingTitle', () => {
  it('recognises careers pages', () => {
    expect(isListingTitle('Zafran Careers')).toBe(true);
    expect(isListingTitle('Jobs at Acme')).toBe(true);
    expect(isListingTitle('Open Positions | Globex')).toBe(true);
    expect(isListingTitle('Senior DevOps Engineer - Zafran')).toBe(false);
  });
});

describe('text signals', () => {
  it('reads workplace type from role descriptions only', () => {
    expect(workplaceTypeFromText('This role is fully remote within the US.')).toBe('remote');
    expect(workplaceTypeFromText('We offer a hybrid schedule of 3 days in office.')).toBe('hybrid');
    expect(
      workplaceTypeFromText('You will collaborate with remote teams across the globe.'),
    ).toBeUndefined();
  });

  it('prefers labelled employment types', () => {
    expect(employmentTypeFromText('Employment type: Contract\nWe offer full-time benefits.')).toBe(
      'contract',
    );
    expect(employmentTypeFromText('This is a full-time position.')).toBe('full_time');
    expect(employmentTypeFromText('You will negotiate contracts with vendors.')).toBeUndefined();
    expect(
      employmentTypeFromText(
        'Experience with contractual negotiations. This full-time position pays well.',
      ),
    ).toBe('full_time');
    expect(employmentTypeFromText('This is a 6 month contract role.')).toBe('contract');
  });

  it('reads labelled locations', () => {
    expect(locationFromText('**Location:** Austin, TX\n\nAbout the role')).toBe('Austin, TX');
    expect(locationFromText('Location: Remote')).toBe('Remote');
    expect(locationFromText('Location: TBD')).toBeUndefined();
  });

  it('reads the company from an About heading', () => {
    expect(companyFromAboutHeading('## About Acme Robotics\n\nWe build robots.')).toBe(
      'Acme Robotics',
    );
    expect(companyFromAboutHeading('## About the role\n\n## About you')).toBeUndefined();
  });
});
