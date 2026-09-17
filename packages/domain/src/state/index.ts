export * from './creative-status';
export * from './copy-status';
export * from './creator-status';
export * from './queue-columns';
export * from './promotion-status';
/**
 * The Client Queue board lives in `../queue` (it is a view of the client track, not a state machine),
 * but ticket `client-queue` criterion 2 requires a component to reach `clientQueueColumns` and
 * `groupByClientStatus` through `@tas/domain/state` alongside `CLIENT_STATUS` and `isClientTrackOpen`
 * — one import for everything a status-bearing component needs. `../queue` imports the status modules
 * directly, never this barrel, so there is no cycle.
 */
export * from '../queue/index';
