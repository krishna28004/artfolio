import { test } from "node:test";
import assert from "node:assert/strict";
import { formatArtworkDimensions } from "../src/features/artwork/utils/format-artwork.ts";

test("artwork detail presentation replaces A3 dimension labels with A4", () => {
  assert.equal(formatArtworkDimensions("A3 Sheet"), "A4 Sheet");
  assert.equal(formatArtworkDimensions("Original, A3 paper"), "Original, A4 paper");
  assert.equal(formatArtworkDimensions("A4 Sheet"), "A4 Sheet");
  assert.equal(formatArtworkDimensions(undefined), "");
});
