#!/usr/bin/env bun

'use strict';

// Compatibility entrypoint. ExploreBench is owned by Consuelo OS; keep one implementation so
// workspace callers inherit the same repo-root resolution, validation, and error semantics.
require('../../os/scripts/explore-bench.js');
