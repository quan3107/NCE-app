import { test } from 'node:test';
import assert from 'node:assert/strict';
import { queryClient } from '../src/lib/queryClient';

test('caches fetch results until invalidated', async () => {
  queryClient.clear();
  let callCount = 0;

  const fetcher = async () => {
    callCount += 1;
    return { value: Math.random() };
  };

  const first = await queryClient.fetchQuery('sample:key', fetcher);
  const second = await queryClient.fetchQuery('sample:key', fetcher);

  assert.deepEqual(second, first);
  assert.equal(callCount, 1);
});

test('subscription receives updates when query data changes', () => {
  queryClient.clear();
  let triggered = 0;

  const unsubscribe = queryClient.subscribe('notify:key', () => {
    triggered += 1;
  });

  queryClient.setQueryData('notify:key', { ready: true });
  unsubscribe();
  queryClient.setQueryData('notify:key', { ready: false });

  assert.equal(triggered, 1);
});

test('invalidatePrefix clears matching entries', () => {
  queryClient.clear();
  queryClient.setQueryData('user:1', { id: 1 });
  queryClient.setQueryData('user:2', { id: 2 });
  queryClient.setQueryData('course:1', { id: 'course-1' });

  queryClient.invalidatePrefix('user:');

  assert.equal(queryClient.getQueryData('user:1'), undefined);
  assert.equal(queryClient.getQueryData('user:2'), undefined);
  assert.deepEqual(queryClient.getQueryData('course:1'), { id: 'course-1' });
});
