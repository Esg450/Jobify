import { describe, expect, it } from 'vitest';
import { enrichDraft } from './enrich.js';
import { draftFromText } from './text-draft.js';

describe('enrichDraft', () => {
  it('fills salary, workplace and employment type from the description', () => {
    const draft = enrichDraft({
      title: 'Backend Engineer (Remote)',
      company: 'Acme',
      description: 'This is a full-time role. Compensation: $150,000 - $180,000 per year.',
    });
    expect(draft).toMatchObject({
      workplaceType: 'remote',
      employmentType: 'full_time',
      salaryMin: 150000,
      salaryMax: 180000,
      salaryCurrency: 'USD',
      salaryPeriod: 'year',
    });
  });

  it('never overwrites what a parser found', () => {
    const draft = enrichDraft({
      title: 'Engineer',
      company: 'Acme',
      location: 'Berlin',
      salaryMin: 1,
      workplaceType: 'onsite',
      description: 'Fully remote. Location: Paris. $200,000 per year.',
    });
    expect(draft).toMatchObject({ location: 'Berlin', salaryMin: 1, workplaceType: 'onsite' });
  });

  it('splits "Title at Company" but leaves dashed titles alone', () => {
    expect(enrichDraft({ title: 'Chef at Le Bistro' })).toMatchObject({
      title: 'Chef',
      company: 'Le Bistro',
    });
    expect(enrichDraft({ title: 'US - Specialist' })).toMatchObject({
      title: 'US - Specialist',
      company: undefined,
    });
  });
});

describe('draftFromText', () => {
  it('reads a posting copied from LinkedIn', () => {
    const draft = enrichDraft(
      draftFromText(`Senior Backend Engineer
Globex Corporation · Austin, TX (Hybrid)
Posted 2 days ago

About the job
Employment type: Full-time
Salary: $150,000 - $180,000 per year.`),
    );
    expect(draft).toMatchObject({
      title: 'Senior Backend Engineer',
      company: 'Globex Corporation',
      location: 'Austin, TX (Hybrid)',
      workplaceType: 'hybrid',
      employmentType: 'full_time',
      salaryMin: 150000,
    });
  });

  it('reads labelled fields', () => {
    expect(
      draftFromText('Job Title: Pastry Chef\nCompany: Le Bistro\nLocation: Paris\n\nBake things.'),
    ).toMatchObject({
      title: 'Pastry Chef',
      company: 'Le Bistro',
      location: 'Paris',
    });
  });

  it('keeps the whole text as the description', () => {
    const text = 'Barista\nBean There\n\nPull shots all day.';
    expect(draftFromText(text)).toMatchObject({
      title: 'Barista',
      company: 'Bean There',
      description: text,
    });
  });
});
