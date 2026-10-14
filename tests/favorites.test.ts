import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFavorites, toggleFavoriteId } from "../src/features/favorites/hooks/favorites-storage.ts";

test("saved artwork IDs ignore malformed or non-list browser data", () => {
  assert.deepEqual(parseFavorites("not-json"), []);
  assert.deepEqual(parseFavorites('{"length":2}'), []);
  assert.deepEqual(parseFavorites('["a",null,"a",4,"b"]'), ["a", "b"]);
});

test("favorite toggles retain the other saved works", () => {
  assert.deepEqual(toggleFavoriteId(["a", "b"], "a"), ["b"]);
  assert.deepEqual(toggleFavoriteId(["a"], "b"), ["a", "b"]);
});
