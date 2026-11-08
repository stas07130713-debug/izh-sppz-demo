import { describe, expect, it } from 'vitest';
import { filterableTypeCodes } from './SystemSummaryPanel';

describe('галочки систем в правом поле', () => {
  const codes = ['hydrant', 'extinguisher-powder', 'detector-smoke'];
  const placed = new Map([['hydrant', 2]]);

  it('на плане управляют только видами с координатами этого плана', () => {
    expect(filterableTypeCodes('plan', codes, placed)).toEqual(['hydrant']);
  });

  it('в журнале доступны все виды вложенной области, даже если они стоят на этажах', () => {
    expect(filterableTypeCodes('journal', codes, placed)).toEqual(codes);
  });
});
