'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Button, Input, RatingStars, StatusChip } from '@tas/ui';
import { ageBracketLabel, creatorPlatformLabel, matchRegistryCreator } from '@tas/domain/creators';
import { creatorStatusLabel, creatorStatusTone } from '@tas/domain/state';
import type {
  CreatorPerformanceHistoryRow,
  RegistryBrandHistoryRow,
  RegistryCreatorListRow,
} from '@tas/db';

import { absoluteTime } from '@/lib/relative-time';

import {
  addRegistryCreatorToBrandAction,
  getRegistryCreatorHistoryAction,
  getRegistryCreatorRatingsAction,
  listRegistryCreatorsAction,
} from './registry-actions';
import { creatorInitials, EM_DASH } from './fields';

export interface CreatorPoolProps {
  readonly brandName: string;
  readonly demo: boolean;
  readonly onAdded?: () => void;
}

export function CreatorPool({ brandName, demo, onAdded }: CreatorPoolProps) {
  const [registryCreators, setRegistryCreators] = useState<RegistryCreatorListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [platformFilter] = useState<string[]>([]);
  const [selectedCreator, setSelectedCreator] = useState<RegistryCreatorListRow | null>(null);
  const [history, setHistory] = useState<RegistryBrandHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [ratings, setRatings] = useState<CreatorPerformanceHistoryRow[]>([]);
  const [adding, startAdding] = useTransition();
  const [addResult, setAddResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listRegistryCreatorsAction().then((rows) => {
      if (!cancelled) {
        setRegistryCreators(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const scored = registryCreators
      .map((c) => ({
        creator: c,
        score: matchRegistryCreator(
          {
            name: c.name,
            instagramUsername: c.instagramUsername,
            platform: c.platform,
            gender: c.gender,
            ageBracket: c.ageBracket,
            totalBrands: c.totalBrands,
            tags: c.tags,
          },
          {
            query: query || undefined,
            platform: platformFilter.length ? platformFilter : undefined,
          },
        ),
      }))
      .filter((entry) => entry.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.map((entry) => entry.creator);
  }, [registryCreators, query, platformFilter]);

  const selectCreator = useCallback((creator: RegistryCreatorListRow) => {
    setSelectedCreator(creator);
    setHistoryLoading(true);
    void Promise.all([
      getRegistryCreatorHistoryAction(creator.id),
      getRegistryCreatorRatingsAction(creator.id),
    ]).then(([rows, rated]) => {
      setHistory(rows);
      setRatings(rated);
      setHistoryLoading(false);
    });
  }, []);

  const handleAdd = useCallback(
    (registryCreatorId: string) => {
      if (demo) return;
      startAdding(async () => {
        const result = await addRegistryCreatorToBrandAction(registryCreatorId);
        if (result.ok) {
          setAddResult(result.alreadyExisted ? 'Already on this brand.' : `Added to ${brandName}!`);
          onAdded?.();
        } else {
          setAddResult(result.error);
        }
        setTimeout(() => {
          setAddResult(null);
        }, 3000);
      });
    },
    [demo, brandName, onAdded],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-text2">
        Loading creator pool…
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="Search by name or Instagram"
          className="h-8 w-full sm:w-64"
          data-slot="pool-search"
        />
        <p className="text-xs text-text3">
          {filtered.length} of {registryCreators.length} creators
        </p>
      </div>

      {addResult !== null && (
        <div className="rounded-card border border-line bg-surface px-3 py-2 text-sm text-text2">
          {addResult}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-10 text-center">
          <p className="text-sm text-text2">
            {registryCreators.length === 0
              ? 'No creators in the global pool yet. Run the seed script to populate from existing brand data.'
              : 'No creators match that search.'}
          </p>
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((creator) => (
              <button
                key={creator.id}
                type="button"
                onClick={() => {
                  selectCreator(creator);
                }}
                className={`flex flex-col gap-2 rounded-card border p-3 text-left transition-colors hover:bg-surface-hover ${
                  selectedCreator?.id === creator.id
                    ? 'border-accent bg-surface'
                    : 'border-line bg-surface'
                }`}
                data-slot="pool-card"
              >
                <div className="flex items-center gap-3">
                  {creator.profilePicUrl ? (
                    <img
                      src={creator.profilePicUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-medium text-accent">
                      {creatorInitials(creator.name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{creator.name}</p>
                    {creator.instagramUsername && (
                      <p className="truncate font-mono text-xs text-text3">
                        @{creator.instagramUsername.replace(/^@/, '')}
                      </p>
                    )}
                  </div>
                </div>
                <RatingStars value={creator.avgRating} readOnly size="sm" label="Average rating" />
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-text2">
                  {creator.platform.length > 0 && (
                    <span>{creator.platform.map((p) => creatorPlatformLabel(p)).join(', ')}</span>
                  )}
                  {creator.totalBrands > 0 && (
                    <span className="rounded bg-accent/10 px-1.5 py-0.5 text-accent">
                      {creator.totalBrands} {creator.totalBrands === 1 ? 'brand' : 'brands'}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={demo || adding}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAdd(creator.id);
                  }}
                  data-slot="add-to-brand"
                >
                  Add to {brandName}
                </Button>
              </button>
            ))}
          </div>

          {selectedCreator !== null && (
            <aside className="hidden w-80 shrink-0 flex-col gap-4 rounded-card border border-line bg-surface p-4 lg:flex">
              <div className="flex items-center gap-3">
                {selectedCreator.profilePicUrl ? (
                  <img
                    src={selectedCreator.profilePicUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-lg font-medium text-accent">
                    {creatorInitials(selectedCreator.name)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-text">{selectedCreator.name}</p>
                  {selectedCreator.instagramUsername && (
                    <p className="font-mono text-xs text-text3">
                      @{selectedCreator.instagramUsername.replace(/^@/, '')}
                    </p>
                  )}
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <dt className="text-text3">Gender</dt>
                <dd className="text-text2">{selectedCreator.gender ?? EM_DASH}</dd>
                <dt className="text-text3">Age</dt>
                <dd className="text-text2">
                  {selectedCreator.ageBracket
                    ? ageBracketLabel(selectedCreator.ageBracket)
                    : EM_DASH}
                </dd>
                <dt className="text-text3">Platforms</dt>
                <dd className="text-text2">
                  {selectedCreator.platform.length > 0
                    ? selectedCreator.platform.map((p) => creatorPlatformLabel(p)).join(', ')
                    : EM_DASH}
                </dd>
                <dt className="text-text3">Location</dt>
                <dd className="text-text2">{selectedCreator.shippingLocation ?? EM_DASH}</dd>
              </dl>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text3">
                  Brand History
                </h3>
                {historyLoading ? (
                  <p className="text-xs text-text3">Loading…</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-text3">No brand history yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {history.map((entry) => (
                      <div
                        key={`${entry.brandId}-${entry.createdAt.toString()}`}
                        className="flex items-center justify-between rounded border border-line px-2 py-1.5 text-xs"
                      >
                        <div>
                          <p className="font-medium text-text">{entry.brandName}</p>
                          <p className="text-text3">
                            {new Date(entry.createdAt).toISOString().slice(0, 7)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusChip
                            label={creatorStatusLabel(entry.clientStatus)}
                            tone={creatorStatusTone(entry.clientStatus)}
                          />
                          {entry.continueWorkingWith !== null && (
                            <span className={entry.continueWorkingWith ? 'text-ok' : 'text-bad'}>
                              {entry.continueWorkingWith ? 'Continue' : 'No'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div data-slot="pool-ratings">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text3">
                  Ratings
                </h3>
                {historyLoading ? (
                  <p className="text-xs text-text3">Loading…</p>
                ) : ratings.length === 0 ? (
                  <p className="text-xs text-text3">Not on any brand yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {ratings.map((entry) => (
                      <li
                        key={entry.creatorId}
                        className="flex flex-col gap-1 rounded border border-line px-2 py-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-text">{entry.brandName}</p>
                          <RatingStars
                            value={entry.rating}
                            readOnly
                            size="sm"
                            label={`${entry.brandName} rating`}
                          />
                        </div>
                        {entry.note !== null && entry.note.trim() !== '' ? (
                          <p className="leading-relaxed text-text2">{entry.note}</p>
                        ) : null}
                        {entry.ratedAt !== null ? (
                          <p className="text-text3">
                            Rated by{' '}
                            <span className="font-mono text-text2">{entry.ratedBy ?? EM_DASH}</span>{' '}
                            <time dateTime={entry.ratedAt.toISOString()}>
                              {absoluteTime(entry.ratedAt)}
                            </time>
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Button
                size="sm"
                disabled={demo || adding}
                onClick={() => {
                  handleAdd(selectedCreator.id);
                }}
                data-slot="add-selected-to-brand"
              >
                Add to {brandName}
              </Button>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
