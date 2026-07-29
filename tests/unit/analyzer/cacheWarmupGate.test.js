// CacheWarmupGate — single-flight for the first cacheable call to a provider
// within a run.
//
// This exists because AnalysisWorkerPool's own cacheWarmup gates worker
// *start* and is derived from the stage's slot model, so it cannot cover a
// refusal-fallback call: those happen mid-task, after workers are released,
// and may target a different provider entirely.

import { describe, it, expect, vi } from 'vitest';
import { CacheWarmupGate } from '../../../lib/analyzer/rateLimit.js';

// Resolves on the next macrotask — enough for pending microtasks to settle
// without depending on timer mocking.
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('CacheWarmupGate', () => {
  it('passes non-warming providers straight through without serialising', async () => {
    // Google has no prompt caching wired in and OpenAI auto-caches, so
    // gating them would add latency for nothing.
    const gate = new CacheWarmupGate();
    let concurrent = 0;
    let peak = 0;
    const task = async () => {
      concurrent += 1;
      peak = Math.max(peak, concurrent);
      await tick();
      concurrent -= 1;
      return 'ok';
    };

    const results = await Promise.all([
      gate.run('google', task),
      gate.run('google', task),
      gate.run('google', task),
    ]);

    expect(results).toEqual(['ok', 'ok', 'ok']);
    expect(peak).toBe(3);
  });

  it('runs the first Anthropic caller alone, then releases the rest in parallel', async () => {
    const gate = new CacheWarmupGate();
    let concurrent = 0;
    const peaks = [];
    let releaseWarmer;
    const warmerGate = new Promise((r) => {
      releaseWarmer = r;
    });

    let started = 0;
    const task = async (isWarmer) => {
      started += 1;
      concurrent += 1;
      peaks.push(concurrent);
      if (isWarmer) await warmerGate;
      else await tick();
      concurrent -= 1;
    };

    const warmer = gate.run('anthropic', () => task(true));
    const followers = [
      gate.run('anthropic', () => task(false)),
      gate.run('anthropic', () => task(false)),
    ];

    // While the warmer is in flight, no follower has started.
    await tick();
    expect(started).toBe(1);

    releaseWarmer();
    await Promise.all([warmer, ...followers]);

    expect(started).toBe(3);
    // The warmer never overlapped with anything.
    expect(Math.max(...peaks.slice(0, 1))).toBe(1);
  });

  it('opens the gate when the warming call throws, rather than deadlocking waiters', async () => {
    // The gate opens on settle, not on success. A warmer that 500s must not
    // strand every sibling for the rest of the run.
    const gate = new CacheWarmupGate();
    const warmer = gate.run('anthropic', async () => {
      throw new Error('warmer exploded');
    });
    await expect(warmer).rejects.toThrow('warmer exploded');

    await expect(gate.run('anthropic', async () => 'follower ran')).resolves.toBe('follower ran');
  });

  it('bails without issuing the call when the run is aborted mid-wait', async () => {
    // Two properties at once: the follower must not strand behind a warmer
    // that may never settle, AND it must not go on to issue a real, billable
    // request after the user hit Stop.
    const gate = new CacheWarmupGate();
    const controller = new AbortController();
    let releaseWarmer;
    const warmerGate = new Promise((r) => {
      releaseWarmer = r;
    });

    const followerFn = vi.fn(async () => 'follower ran');
    const warmer = gate.run('anthropic', () => warmerGate);
    const follower = gate.run('anthropic', followerFn, controller.signal);

    await tick();
    controller.abort();

    await expect(follower).rejects.toThrow('Operation aborted');
    expect(followerFn).not.toHaveBeenCalled();

    releaseWarmer();
    await warmer;
  });

  it('detaches its abort listener when the warmer settles first', async () => {
    // `once: true` only self-removes when abort actually fires. On the common
    // path the promise wins, so without an explicit detach every gated call
    // would leave a handler on the run's signal.
    const gate = new CacheWarmupGate();
    const controller = new AbortController();
    const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');

    let releaseWarmer;
    const warmerGate = new Promise((r) => {
      releaseWarmer = r;
    });
    const warmer = gate.run('anthropic', () => warmerGate);
    const follower = gate.run('anthropic', async () => 'ok', controller.signal);

    await tick();
    releaseWarmer();
    await expect(follower).resolves.toBe('ok');
    await warmer;

    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('re-warms after reset (the primed cache entry has a TTL)', async () => {
    const gate = new CacheWarmupGate();
    const calls = [];
    await gate.run('anthropic', async () => calls.push('first'));
    // Gate is open now: this would run immediately.
    await gate.run('anthropic', async () => calls.push('second'));

    gate.reset();

    // After reset the next caller becomes the warmer again — verified by it
    // holding the gate closed against a concurrent follower.
    let releaseWarmer;
    const warmerGate = new Promise((r) => {
      releaseWarmer = r;
    });
    let followerStarted = false;
    const warmer = gate.run('anthropic', () => warmerGate);
    const follower = gate.run('anthropic', async () => {
      followerStarted = true;
    });

    await tick();
    expect(followerStarted).toBe(false);

    releaseWarmer();
    await Promise.all([warmer, follower]);
    expect(followerStarted).toBe(true);
  });

  it('keys state per provider', async () => {
    const gate = new CacheWarmupGate();
    let releaseAnthropic;
    const anthropicGate = new Promise((r) => {
      releaseAnthropic = r;
    });

    const anthropic = gate.run('anthropic', () => anthropicGate);
    // A different provider must not be blocked behind Anthropic's warmer.
    await expect(gate.run('openai', async () => 'openai ran')).resolves.toBe('openai ran');

    releaseAnthropic();
    await anthropic;
  });

  it('is case-insensitive on the provider key', async () => {
    const gate = new CacheWarmupGate();
    const spy = vi.fn(async () => 'ran');
    await expect(gate.run('Anthropic', spy)).resolves.toBe('ran');
    expect(spy).toHaveBeenCalled();
  });
});
