import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tests } from './tests.data.js';
import { score } from './scoring.js';
for (const definition of tests) {
  test(definition.id + ': прямі та зворотні відповіді', () => {
    assert.equal(score(definition, definition.questions.map(q => q[1] ? 5 : 1)).percent, 0);
    assert.equal(score(definition, definition.questions.map(q => q[1] ? 1 : 5)).percent, 100);
    assert.equal(score(definition, definition.questions.map(() => 3)).percent, 50);
  });
  test(definition.id + ': відхилення некоректних відповідей', () => {
    for (const answers of [null, [], [1,2], [0,1,2,3,4,5], [1,2,3,4,5,6], ['1',2,3,4,5,1], new Array(6)]) {
      assert.throws(() => score(definition, answers));
    }
  });
}
