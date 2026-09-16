import { describe, expect, it } from 'vitest';

import {
  INHERITED_ANGLE_FIELDS,
  INHERITED_ANGLE_FIELD_KEYS,
  inheritedFromAngle,
  isInheritedFromAngle,
  type InheritedAngle,
} from './inherited-from-angle';

const angle: InheritedAngle = {
  description: 'Shift work is not a sleep disorder; the rota is the abnormal thing.',
  painPoints: 'Falls asleep at 9am in a bright room, wakes at noon, dreads the 19:00 shift.',
  usp: 'Breathable weight instead of sedation.',
  personaName: 'Night-Shift Nurse',
  productName: 'Weighted Blanket',
};

describe('INHERITED_ANGLE_FIELDS', () => {
  it('is the five PRD §5.7 fields in render order', () => {
    expect(INHERITED_ANGLE_FIELDS.map((field) => field.key)).toEqual([
      'description',
      'painPoints',
      'usp',
      'personaName',
      'productName',
    ]);
  });

  it('labels them the way the page does', () => {
    expect(INHERITED_ANGLE_FIELDS.map((field) => field.label)).toEqual([
      'Description',
      'Pain Points',
      'USP',
      'Persona',
      'Product',
    ]);
  });

  it('exposes the keys and answers whether a field is inherited', () => {
    expect(INHERITED_ANGLE_FIELD_KEYS).toHaveLength(5);
    expect(isInheritedFromAngle('usp')).toBe(true);
    expect(isInheritedFromAngle('personaName')).toBe(true);
    // Fields the strategist fills in herself are editable and must not appear here.
    expect(isInheritedFromAngle('hookExamples')).toBe(false);
    expect(isInheritedFromAngle('category')).toBe(false);
    expect(isInheritedFromAngle('name')).toBe(false);
  });
});

describe('inheritedFromAngle', () => {
  it('reads all five fields off a complete angle, in order', () => {
    expect(inheritedFromAngle(angle)).toEqual([
      { key: 'description', label: 'Description', value: angle.description },
      { key: 'painPoints', label: 'Pain Points', value: angle.painPoints },
      { key: 'usp', label: 'USP', value: angle.usp },
      { key: 'personaName', label: 'Persona', value: 'Night-Shift Nurse' },
      { key: 'productName', label: 'Product', value: 'Weighted Blanket' },
    ]);
  });

  it('keeps the shape with no angle at all, every value null', () => {
    const fields = inheritedFromAngle(null);
    expect(fields).toHaveLength(5);
    expect(fields.map((field) => field.value)).toEqual([null, null, null, null, null]);
    expect(fields.map((field) => field.key)).toEqual(INHERITED_ANGLE_FIELD_KEYS);
  });

  it('nulls the one field the angle does not carry and keeps the rest', () => {
    const fields = inheritedFromAngle({ ...angle, productName: null });
    expect(fields.find((field) => field.key === 'productName')?.value).toBeNull();
    expect(fields.find((field) => field.key === 'personaName')?.value).toBe('Night-Shift Nurse');
  });

  it('normalises a blank or whitespace-only value to null, so it renders as the em dash', () => {
    const fields = inheritedFromAngle({ ...angle, painPoints: '', usp: '   ' });
    expect(fields.find((field) => field.key === 'painPoints')?.value).toBeNull();
    expect(fields.find((field) => field.key === 'usp')?.value).toBeNull();
  });

  it('re-fills every field when a different angle is chosen', () => {
    const other: InheritedAngle = {
      description: 'Ninety minutes is the window she actually gets.',
      painPoints: 'Handover at seven, bright east-facing flat.',
      usp: 'Blocks light, not sound.',
      personaName: 'New Parent',
      productName: 'Sleep Mask',
    };
    expect(inheritedFromAngle(other).map((field) => field.value)).toEqual([
      other.description,
      other.painPoints,
      other.usp,
      'New Parent',
      'Sleep Mask',
    ]);
  });
});
