# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.13.4](https://github.com/Wildhoney/MarchHare/compare/v0.13.0...v0.13.4) (2026-06-17)

### Features

- **cache:** add per-context key(context) scoping to Cache config ([320e284](https://github.com/Wildhoney/MarchHare/commit/320e28401a057eefb874ea03742defbc8103fe46))
- **cli:** add mh scaffolding CLI for apps and features ([05b940a](https://github.com/Wildhoney/MarchHare/commit/05b940a931f2536d0ced8c75df61379af938f576))
- **core:** re-export isBox from immertation (^0.1.27) ([cf832bd](https://github.com/Wildhoney/MarchHare/commit/cf832bd538104b2cec4c221a8190d6abaaaca0ad))

## [0.13.3](https://github.com/Wildhoney/MarchHare/compare/v0.13.0...v0.13.3) (2026-06-17)

### Features

- **cache:** add per-context key(context) scoping to Cache config ([320e284](https://github.com/Wildhoney/MarchHare/commit/320e28401a057eefb874ea03742defbc8103fe46))
- **cli:** add mh scaffolding CLI for apps and features ([05b940a](https://github.com/Wildhoney/MarchHare/commit/05b940a931f2536d0ced8c75df61379af938f576))
- **core:** re-export isBox from immertation (^0.1.27) ([cf832bd](https://github.com/Wildhoney/MarchHare/commit/cf832bd538104b2cec4c221a8190d6abaaaca0ad))

## [0.13.2](https://github.com/Wildhoney/MarchHare/compare/v0.13.0...v0.13.2) (2026-06-17)

### Features

- **cache:** add per-context key(context) scoping to Cache config ([320e284](https://github.com/Wildhoney/MarchHare/commit/320e28401a057eefb874ea03742defbc8103fe46))
- **cli:** add mh scaffolding CLI for apps and features ([05b940a](https://github.com/Wildhoney/MarchHare/commit/05b940a931f2536d0ced8c75df61379af938f576))
- **core:** re-export isBox from immertation (^0.1.27) ([cf832bd](https://github.com/Wildhoney/MarchHare/commit/cf832bd538104b2cec4c221a8190d6abaaaca0ad))

## [0.13.1](https://github.com/Wildhoney/MarchHare/compare/v0.13.0...v0.13.1) (2026-06-16)

### Features

- **cli:** add mh scaffolding CLI for apps and features ([05b940a](https://github.com/Wildhoney/MarchHare/commit/05b940a931f2536d0ced8c75df61379af938f576))

## [0.13.0](https://github.com/Wildhoney/MarchHare/compare/v0.12.1...v0.13.0) (2026-06-15)

### ⚠ BREAKING CHANGES

- **resource:** return Invocation from handle call, add .get() for sync reads
- strictly sync Cache adapter and evict/nuke; recommend react-native-mmkv for RN
- async evict/nuke, async Cache adapter, type-aware no-floating-promises lint
- replace Resource.Cachable with App({cache}) and add resource.evict/nuke

- **resource:** return Invocation from handle call, add .get() for sync reads ([7ac8414](https://github.com/Wildhoney/MarchHare/commit/7ac8414f2da6afd528410ea650b366719b696c40))

### Features

- async evict/nuke, async Cache adapter, type-aware no-floating-promises lint ([19a8186](https://github.com/Wildhoney/MarchHare/commit/19a81863209eeb7f95fe33bc039257d8539c2c23))
- replace Resource.Cachable with App({cache}) and add resource.evict/nuke ([eace7a1](https://github.com/Wildhoney/MarchHare/commit/eace7a14a7e933b21d469ec21a9aee0515aa5976))
- strictly sync Cache adapter and evict/nuke; recommend react-native-mmkv for RN ([c90b19b](https://github.com/Wildhoney/MarchHare/commit/c90b19bbf70973e262c5614d0898091a3ba92765))

## [0.12.1](https://github.com/Wildhoney/MarchHare/compare/v0.12.0...v0.12.1) (2026-06-12)

## [0.12.0](https://github.com/Wildhoney/MarchHare/compare/v0.11.1...v0.12.0) (2026-06-12)

### ⚠ BREAKING CHANGES

- group standalone Env-first hooks under shared namespace

- group standalone Env-first hooks under shared namespace ([44ba336](https://github.com/Wildhoney/MarchHare/commit/44ba33638ddb5d113c24bce3d4ba9da6ecce5b87))

## [0.11.1](https://github.com/Wildhoney/MarchHare/compare/v0.11.0...v0.11.1) (2026-06-10)

### Features

- added useApp hook for reusable components ([a3dcfcb](https://github.com/Wildhoney/MarchHare/commit/a3dcfcbde79693e1db3b2743cc4cca9fbdce2d8b))

## [0.11.0](https://github.com/Wildhoney/MarchHare/compare/v0.10.0...v0.11.0) (2026-06-10)

### ⚠ BREAKING CHANGES

- **app:** drop env/tap overrides on app.Boundary; fix them at App() time
- drop nested-dispatch task cascade; keep typed Aborted reasons and 30s race
- cascade aborts through nested dispatches and propagate Aborted reason

### revert

- drop nested-dispatch task cascade; keep typed Aborted reasons and 30s race ([698a119](https://github.com/Wildhoney/MarchHare/commit/698a119f27cb227733737945fd28a40e64026fa8))

### Features

- **app:** drop env/tap overrides on app.Boundary; fix them at App() time ([f666cc2](https://github.com/Wildhoney/MarchHare/commit/f666cc2da2d8d7ea51726fd1093733db0897e41b))
- cascade aborts through nested dispatches and propagate Aborted reason ([4e8c3c6](https://github.com/Wildhoney/MarchHare/commit/4e8c3c6ec26163602ea15fb6238afa4b511cc866))

### Bug Fixes

- **example:** cancel promote-user fetch on timeout via ky timeout option ([ec2bb4b](https://github.com/Wildhoney/MarchHare/commit/ec2bb4b7cce4bc874ee0fe35c227e14ca49fa4fe))

## [0.10.0](https://github.com/Wildhoney/MarchHare/compare/v0.9.0...v0.10.0) (2026-06-07)

### ⚠ BREAKING CHANGES

- await async generator handlers; race long dispatches in AsyncButton
- thread App env shape into handler context, produce draft, and Lifecycle.Env subscriptions

### Features

- add Boundary tap observer ([ab3c73e](https://github.com/Wildhoney/MarchHare/commit/ab3c73ec5fb6f8262030aadedfeebcb79d3329e0))
- await async generator handlers; race long dispatches in AsyncButton ([c1aa66c](https://github.com/Wildhoney/MarchHare/commit/c1aa66c9c3293fd1f4e745ec099029f0035fb01f))
- thread App env shape into handler context, produce draft, and Lifecycle.Env subscriptions ([d9e9341](https://github.com/Wildhoney/MarchHare/commit/d9e934108d9261220036667be09e13b6dc83fc15))
- typed context.with helpers with lodash-style paths and Always ([68dc40f](https://github.com/Wildhoney/MarchHare/commit/68dc40feda42e7a9a0367a2a816c8c413bcf75ff))

## [0.9.0](https://github.com/Wildhoney/MarchHare/compare/v0.7.5...v0.9.0) (2026-06-01)

### ⚠ BREAKING CHANGES

- rename Store primitive to Env (App({env}), useEnv, context.env, Lifecycle.Env)
- app.Scope<MulticastActions>() replaces withScope; rename Reactive→Maybe, AbortError→Aborted
- **app:** add App factory for typed Store binding with per-Boundary coalesce sharing
- **resource:** split Resource and Resource.Cachable, add broadcast/multicast dispatch on fetcher context
- rename core API to useContext returning Context with context.actions.dispatch
- rename core API to useContext/Context with renamed action surface

- app.Scope<MulticastActions>() replaces withScope; rename Reactive→Maybe, AbortError→Aborted ([aaaa099](https://github.com/Wildhoney/MarchHare/commit/aaaa099de52cf7be557e6367fd85fc9b5dab88b2))
- rename Store primitive to Env (App({env}), useEnv, context.env, Lifecycle.Env) ([54f4b81](https://github.com/Wildhoney/MarchHare/commit/54f4b81c39b70b74b04722a30af450a079e5ce2c))

### Features

- **app:** add App factory for typed Store binding with per-Boundary coalesce sharing ([abdedb5](https://github.com/Wildhoney/MarchHare/commit/abdedb53b80065a3964af6fe38e426fa3fd8b95c))
- rename core API to useContext returning Context with context.actions.dispatch ([1854d65](https://github.com/Wildhoney/MarchHare/commit/1854d65ee24aee593fdd993193b2043681ff448d))
- rename core API to useContext/Context with renamed action surface ([1676b70](https://github.com/Wildhoney/MarchHare/commit/1676b702f6db0685509e55d98698c26ae0a48f20))
- **resource:** split Resource and Resource.Cachable, add broadcast/multicast dispatch on fetcher context ([15bc4b0](https://github.com/Wildhoney/MarchHare/commit/15bc4b0ea6b2d8b0b62137d06b203522f7cc6678))

## [0.8.0](https://github.com/Wildhoney/MarchHare/compare/v0.7.5...v0.8.0) (2026-05-29)

### ⚠ BREAKING CHANGES

- rename core API to useContext returning Context with context.actions.dispatch
- rename core API to useContext/Context with renamed action surface

### Features

- rename core API to useContext returning Context with context.actions.dispatch ([1854d65](https://github.com/Wildhoney/MarchHare/commit/1854d65ee24aee593fdd993193b2043681ff448d))
- rename core API to useContext/Context with renamed action surface ([1676b70](https://github.com/Wildhoney/MarchHare/commit/1676b702f6db0685509e55d98698c26ae0a48f20))

## [0.7.5](https://github.com/Wildhoney/MarchHare/compare/v0.7.4...v0.7.5) (2026-05-29)

### Features

- **hooks:** expose data as the third tuple element of useActions for JSX consumption ([cf7f27e](https://github.com/Wildhoney/MarchHare/commit/cf7f27e2e69a8a68157cfb05a6bebda5f839f966))

## [0.7.4](https://github.com/Wildhoney/MarchHare/compare/v0.7.3...v0.7.4) (2026-05-29)

## [0.7.3](https://github.com/Wildhoney/MarchHare/compare/v0.7.1...v0.7.3) (2026-05-29)

### Features

- **lifecycle:** add Lifecycle.Store broadcast and actions.dispatch convenience ([9226eee](https://github.com/Wildhoney/MarchHare/commit/9226eee4c85eb39435d15d4d25ff863445397431))

### Bug Fixes

- **types:** preserve root actions in Handlers context for nested handlers ([b6c0adb](https://github.com/Wildhoney/MarchHare/commit/b6c0adbea8c26034396778538e91e8b49430a540))

## [0.7.2](https://github.com/Wildhoney/MarchHare/compare/v0.7.1...v0.7.2) (2026-05-27)

### Features

- **lifecycle:** add Lifecycle.Store broadcast and actions.dispatch convenience ([9226eee](https://github.com/Wildhoney/MarchHare/commit/9226eee4c85eb39435d15d4d25ff863445397431))

## [0.7.1](https://github.com/Wildhoney/MarchHare/compare/v0.7.0...v0.7.1) (2026-05-27)

### Bug Fixes

- **build:** emit .d.ts at dist root and strip .ts/.tsx import extensions ([8b423c5](https://github.com/Wildhoney/MarchHare/commit/8b423c56bef1670370fa8f287d0a13d8a0124e00))

## [0.7.0](https://github.com/Wildhoney/MarchHare/compare/v0.6.1...v0.7.0) (2026-05-27)

### ⚠ BREAKING CHANGES

- **types:** dispatch/useAction reject foreign actions and require declared payloads
- **resource:** collapse to single call-form — cat({id:5}) reads cache and primes context.actions.resource(...)/.set(...)
- redesign Resource/Store/Cache — context.actions.resource(...).exceeds, dot-read Store, drop useResource/useMode

### Features

- redesign Resource/Store/Cache — context.actions.resource(...).exceeds, dot-read Store, drop useResource/useMode ([293732f](https://github.com/Wildhoney/MarchHare/commit/293732f37cba561e68fc1f17b55f76a91c34cbb6))
- **resource:** collapse to single call-form — cat({id:5}) reads cache and primes context.actions.resource(...)/.set(...) ([4141169](https://github.com/Wildhoney/MarchHare/commit/414116930802c1ab1bd9f41cca8cd6d16bec5dc2))

### Bug Fixes

- **types:** dispatch/useAction reject foreign actions and require declared payloads ([3c23156](https://github.com/Wildhoney/MarchHare/commit/3c23156e6437a1a37bf24d80172a83ae72e5119c))

## [0.6.1](https://github.com/Wildhoney/MarchHare/compare/v0.6.0...v0.6.1) (2026-05-20)

### Features

- **resource:** persist cache across reloads via utils.store and Stored<T> ([7c4a140](https://github.com/Wildhoney/MarchHare/commit/7c4a140623c04c34684d389a59a322d5e6c7721f))
- **utils:** add Adapter.clear, boolean Store.set, Encoded type, σ alias ([fd2291d](https://github.com/Wildhoney/MarchHare/commit/fd2291d3de2b06861da79baadeff778f07d1bfc0))

### Bug Fixes

- **deploy:** flatten example index.html to dist-example root ([c30c7a5](https://github.com/Wildhoney/MarchHare/commit/c30c7a5a36b1262ee03c4c56ff9b81da07badabb))
- **example:** pass BASE_URL as BrowserRouter basename so deployed routes resolve under /MarchHare/ ([838b10c](https://github.com/Wildhoney/MarchHare/commit/838b10c11f9f4cb65852e336ab59c307d246690b))
- update path for example ([4608dbf](https://github.com/Wildhoney/MarchHare/commit/4608dbfbf04974a2d175a7417b8934eee84524dc))

## [0.6.0](https://github.com/Wildhoney/Chizu/compare/v0.2.27...v0.6.0) (2026-05-13)

### ⚠ BREAKING CHANGES

- **api:** multicasts self-scope via withScope, drop regulator+meta, rename With.{Update,Invert}, add useMode
- **scope:** drop ScopeCarrier, take scope name string directly
- **error:** replace <Error> boundary with Lifecycle.Fault broadcast

- **api:** multicasts self-scope via withScope, drop regulator+meta, rename With.{Update,Invert}, add useMode ([590740d](https://github.com/Wildhoney/Chizu/commit/590740d02b8b06ae1a3a7687a209090260eb6da3))
- **error:** replace <Error> boundary with Lifecycle.Fault broadcast ([f29dd1a](https://github.com/Wildhoney/Chizu/commit/f29dd1a1f953b86821ab606edb9c5132231499de))
- **scope:** drop ScopeCarrier, take scope name string directly ([2c78815](https://github.com/Wildhoney/Chizu/commit/2c78815fb0a01ee07a2675c351ce8263de049351))

### Features

- abort in-flight actions on unmount, add own() methods, unify to array notation ([1e66147](https://github.com/Wildhoney/Chizu/commit/1e6614768f3fd9c8e7679070ea6c413b2e5c89f1))
- add cache layer with cacheable, invalidate, and model initialisation ([1d1dbb2](https://github.com/Wildhoney/Chizu/commit/1d1dbb2507759f91ff71bfc485cc5f9b48da7d0d))
- add consume() method for subscribing to distributed action values ([594d231](https://github.com/Wildhoney/Chizu/commit/594d231cc3a840b8ea07634dad93656589046e7f))
- add Lifecycle.Element for element capture events with channeled subscriptions ([4da7f9e](https://github.com/Wildhoney/Chizu/commit/4da7f9e31dd852a35d84a716e6c9215fb8cabcb3))
- add nested Actions.Multicast pattern with typed dispatch overloads ([eaa1ff0](https://github.com/Wildhoney/Chizu/commit/eaa1ff0f8cee740707f0616c47d4b056f0758fa2))
- add tuple type pattern for useAction and useActions hooks ([bb463b0](https://github.com/Wildhoney/Chizu/commit/bb463b0c27f3ce90f1fe05d503a3f65d337d54e9))
- add With.Filter helper and organize utils under With namespace ([53c23c2](https://github.com/Wildhoney/Chizu/commit/53c23c247d8273bc2396096ec4085e21ec938ea9))
- added + updated decorators ([c96215e](https://github.com/Wildhoney/Chizu/commit/c96215ec1aef32869babeb245dcda2570d776ef3))
- added <Visitor /> example for real-time data ([26df7a5](https://github.com/Wildhoney/Chizu/commit/26df7a559d38a632be5ba66dcab5b70dc2b36600))
- added action decorators and updated README ([5da6166](https://github.com/Wildhoney/Chizu/commit/5da616695c022b4bdb3c1839fcccf2b687e0a43a))
- added actions.useReactive hook ([152054c](https://github.com/Wildhoney/Chizu/commit/152054c912d0674f456ca74f1e1776032508fd32))
- added Bound function for simple assignments ([a47bf6a](https://github.com/Wildhoney/Chizu/commit/a47bf6a2bdb22e0d362e94e0a84c093f7940b0fc))
- added checksum util fn and documented the util fns ([699ff84](https://github.com/Wildhoney/Chizu/commit/699ff844000f1fc7f4ea8e70435c785db7b2c5c9))
- added concept of features and made dispatch awaitable ([4565a45](https://github.com/Wildhoney/Chizu/commit/4565a45a73739065d44702151bf8c1d789fac607))
- added decorators + updated README ([8949d13](https://github.com/Wildhoney/Chizu/commit/8949d13407d2189e44c0ce6bbd560514489ee669))
- added error handling context ([01c1510](https://github.com/Wildhoney/Chizu/commit/01c15105f0755be06b954405d8c86e9542c68473))
- added initial decorator example ([8af20b7](https://github.com/Wildhoney/Chizu/commit/8af20b74f10895e5576123a785ce7af64633fa3f))
- added integration test for the counter example ([56e557b](https://github.com/Wildhoney/Chizu/commit/56e557b3bc046a736f35d849e4e9bea0f426e5db))
- added late dispatching for useAction(DistributedAction) ([0999e49](https://github.com/Wildhoney/Chizu/commit/0999e49694ee433e1e1c09ea7b473327288b2286))
- added Lifecycle.Update with diff ([4d8aa36](https://github.com/Wildhoney/Chizu/commit/4d8aa366b772a73e59a1ca18d5bfa59f5f40f1d8))
- added rulebook with associated integration tests + rulebook ([b6cbffa](https://github.com/Wildhoney/Chizu/commit/b6cbffa2e0310b78f1431028a734be2165b9f191))
- added the ability to dispatch events using partial object matching ([4898c10](https://github.com/Wildhoney/Chizu/commit/4898c1012e885201217abfe1025d3152f53681a3))
- added withScope HOC for multicast actions ([eadb5c0](https://github.com/Wildhoney/Chizu/commit/eadb5c0c898dce7190494d0db8dda9627dcb6014))
- **annotate:** add standalone annotate function for initial model Op states ([2a88a4b](https://github.com/Wildhoney/Chizu/commit/2a88a4b1b174df6c3600e638eca0aebb79cda5c3))
- **cache:** add Entry factory with cacheable/invalidate on context.actions ([42a7ba6](https://github.com/Wildhoney/Chizu/commit/42a7ba6efa18ad069762e450165836d3f9c723a9))
- changed the channeled actions approach ([0bdcd60](https://github.com/Wildhoney/Chizu/commit/0bdcd60690fa88a222492f1fee0ba833f50c9543))
- changed the interface of the regulator object ([7a3f482](https://github.com/Wildhoney/Chizu/commit/7a3f482932af49f14f5fa3115522631e0a95bd0d))
- **deps:** update immertation to ^0.1.26 ([15a674e](https://github.com/Wildhoney/Chizu/commit/15a674e7f1de574e70ce89c79598a99308e10bca))
- **hooks:** add context.actions.consume for handler-side broadcast/multicast reads ([615332f](https://github.com/Wildhoney/Chizu/commit/615332f8b3dea679a5b815ff897f42bf9ca61ea6))
- **hooks:** add multicast cached replay on mount and document deduplication patterns ([6e4abe9](https://github.com/Wildhoney/Chizu/commit/6e4abe94871955cc63bfe69a0acac4766b77c79b))
- **hooks:** add peek() for synchronous reads and JSX consume() on actions tuple ([d635a65](https://github.com/Wildhoney/Chizu/commit/d635a65e09d82977115293c949e9497fcc52fae0))
- **hooks:** convert lifecycle actions to factory functions for per-component regulation ([f408fb9](https://github.com/Wildhoney/Chizu/commit/f408fb985a5da056037de889218a5d24254f9cd4))
- **hooks:** support void actions type parameter in useActions with void,void defaults ([de47323](https://github.com/Wildhoney/Chizu/commit/de4732305f93847e023f0bdb95c13fbf8d0faebb))
- implement real Immertation inspect for consume() and rename ConsumeRenderer to Partition ([84cb3aa](https://github.com/Wildhoney/Chizu/commit/84cb3aa5b4485758f5f40570c491883ef0bfd4db))
- improved the appearance of the example ([d5ea529](https://github.com/Wildhoney/Chizu/commit/d5ea5294908957bdef69277e356d82c769521ac1))
- improved the typing of the useAction fn ([3393907](https://github.com/Wildhoney/Chizu/commit/3393907cd8fcf74ca8016a7fd2fec4b6eda5b30a))
- improved typings around the actions ([3cc511b](https://github.com/Wildhoney/Chizu/commit/3cc511b81695ece5602008b69939ac07ccf1f8ef))
- integrated immeration ([11641a7](https://github.com/Wildhoney/Chizu/commit/11641a796066ad5791de694f7576578b946e09dd))
- new implementation for the annotations ([eec20b2](https://github.com/Wildhoney/Chizu/commit/eec20b28483f6967a4df746e5bb79255934f7c8d))
- re-added the model stateful and stateless concept ([0beb7c4](https://github.com/Wildhoney/Chizu/commit/0beb7c4a68cfbadf5c038495e2c2765ca4d68430))
- read context.model from state ref to prevent stale closure reads ([e8a0d4a](https://github.com/Wildhoney/Chizu/commit/e8a0d4a64082b56edaf12cbc09a985f6566fa657))
- regulator class ([97f23be](https://github.com/Wildhoney/Chizu/commit/97f23bec165d0c2ed379bd3930b7b6c030d502b7))
- **rehydrate:** add typed Id<M, C> store factory and context.actions.invalidate for rehydration snapshots ([54b208f](https://github.com/Wildhoney/Chizu/commit/54b208f8d1962e08fcd25173d4f60b827ceff3ec))
- removed the regulator class in favour of Set<Task> ([c48286d](https://github.com/Wildhoney/Chizu/commit/c48286d196af991ec23751c6837883064343372f))
- replace cache layer with rehydration for persisting state across unmount/remount cycles ([b559b7c](https://github.com/Wildhoney/Chizu/commit/b559b7c43880dbbfdd5a7a6d4f7373df0d909884))
- **resource:** rework useResource to return { fetch, cache, fetched } with fetch.unless ([4b3402c](https://github.com/Wildhoney/Chizu/commit/4b3402cc0d9ec92f4662e6991b0ff47d34dec7fa))
- **scope:** derive withScope wrapper name from wrapped component ([5150b91](https://github.com/Wildhoney/Chizu/commit/5150b917742a59ebc7652c9598f5508db5a8cff3))
- simplified the README ([7f3dab9](https://github.com/Wildhoney/Chizu/commit/7f3dab910b56f85f10c0e45f508f7b051567e0f3))
- support dot-notation for nested action namespaces in Handlers type ([a35f0d7](https://github.com/Wildhoney/Chizu/commit/a35f0d7f2bbf033e86e119e0116fdb5a5684b949))
- support variadic arguments in regulator matching methods ([a1bb779](https://github.com/Wildhoney/Chizu/commit/a1bb779b7246b9cd3ad8cd98ff4596a8e069b9ad))
- support void model type in useActions for stateless action-only components ([5d420ff](https://github.com/Wildhoney/Chizu/commit/5d420fff69095d6377dfc3d0f01637faf532a59c))
- supporting async and generator actions ([abbf73c](https://github.com/Wildhoney/Chizu/commit/abbf73c5e046235d563ee25ea624a9f4b7b6b723))
- supporting custom error classes ([d7e49af](https://github.com/Wildhoney/Chizu/commit/d7e49af66cb6f850e491781a58618fc5cc8516f8))
- **types:** add Features and Nodes utility types with Property symbol keys ([5500257](https://github.com/Wildhoney/Chizu/commit/55002571abf7e6748ced904384d959b06c1e449a))
- **types:** support dot-notated nested actions in Handlers HKT ([295e4c1](https://github.com/Wildhoney/Chizu/commit/295e4c16acae2c7d418e30febf2f2505e584f192))
- update api to improve readability ([cfc5061](https://github.com/Wildhoney/Chizu/commit/cfc5061d218383b6c07fcc3429cafc4c22d91dbe))
- update Immertation to 0.1.21 and set yarn as package manager ([d4b1909](https://github.com/Wildhoney/Chizu/commit/d4b19096db9603c6309ef60f6388968966d1a257))
- updated inteface for the regulator ([5a3ad80](https://github.com/Wildhoney/Chizu/commit/5a3ad80d27fb4b915a282e9ec9b36d22d72481ef))
- updated the api for the reactive() decorator ([800bf11](https://github.com/Wildhoney/Chizu/commit/800bf11952f8afbd05d97331acbbc695d6d64b0f))
- upgraded to latest immertation version ([4065a1b](https://github.com/Wildhoney/Chizu/commit/4065a1bde44875580ea312da77bd6f3904755ed8))
- use `useEffectEvent` for the `useAction` hook ([a75a145](https://github.com/Wildhoney/Chizu/commit/a75a145f484d9b9b732253457a097875b1af6d66))
- using ref to allow for sync actions ([5bc897d](https://github.com/Wildhoney/Chizu/commit/5bc897d34cbad4d4ff28b2dea406334727c8ac8c))
- **utils:** add signal-aware poll() utility and make sleep() signal arg explicit ([4603ace](https://github.com/Wildhoney/Chizu/commit/4603aced8050900272ed8ec431dba466477d5b6a))

### Bug Fixes

- bug with the strings as action names ([f4cd779](https://github.com/Wildhoney/Chizu/commit/f4cd77992549de13330ce1fd924e40a6b8735de0))
- emitting Lifecycle.Node ([95db16f](https://github.com/Wildhoney/Chizu/commit/95db16f1dbb7d2cd5604ebfeefd72bbd4f9b092a))
- **hooks:** discard implicit return values from produce callbacks ([e6f6417](https://github.com/Wildhoney/Chizu/commit/e6f6417db6286b4a0ac663f2a05b7478d7f5c2dc))
- **hooks:** re-emit Lifecycle.Mount after <Activity> show ([2efc657](https://github.com/Wildhoney/Chizu/commit/2efc657341d64d2140b2dece1b5d0f7a3c4e7c89))
- playwright ci ([8db6641](https://github.com/Wildhoney/Chizu/commit/8db664153791ea22df30fc9f238b613084018316))
- replay broadcast values for useAction handlers without consume ([014e273](https://github.com/Wildhoney/Chizu/commit/014e273cd374d913ca0eb1e7108cae47b450d40f))
- tests + lint + typecheck ([5fe94ac](https://github.com/Wildhoney/Chizu/commit/5fe94ac97d57f8954997b0156b20e00a2c2894d7))
- tests + lint + typecheck ([91678c3](https://github.com/Wildhoney/Chizu/commit/91678c36546799208a857d487e21938ed85f6f01))
- **types:** allow action-based derive with void model by removing never guard ([7decfaa](https://github.com/Wildhoney/Chizu/commit/7decfaa4a27eefc008ada319c04eb785773c12c9))
- update GitHub URLs and fix example build configuration ([1728a16](https://github.com/Wildhoney/Chizu/commit/1728a16c9d93a035f35f385aa4c41befee82e5a7))
- yarn resolutions ([debadaf](https://github.com/Wildhoney/Chizu/commit/debadafa0aef48d88329fbff23717666baff6e31))

## [0.5.2](https://github.com/Wildhoney/Chizu/compare/v0.5.1...v0.5.2) (2026-05-09)

## [0.5.1](https://github.com/Wildhoney/Chizu/compare/v0.5.0...v0.5.1) (2026-05-09)

### Bug Fixes

- **hooks:** re-emit Lifecycle.Mount after <Activity> show ([defe01e](https://github.com/Wildhoney/Chizu/commit/defe01eeec182aebc079390db3a2e4b5d032ca70))

## [0.5.0](https://github.com/Wildhoney/Chizu/compare/v0.4.0...v0.5.0) (2026-05-08)

### ⚠ BREAKING CHANGES

- **api:** multicasts self-scope via withScope, drop regulator+meta, rename With.{Update,Invert}, add useMode

- **api:** multicasts self-scope via withScope, drop regulator+meta, rename With.{Update,Invert}, add useMode ([82a89c9](https://github.com/Wildhoney/Chizu/commit/82a89c926922990fe4bb8fbbcb5bd4a0eaf0d035))

### Bug Fixes

- yarn resolutions ([b334ecf](https://github.com/Wildhoney/Chizu/commit/b334ecf7fcb17505dbcf9037f228584efffdb8c6))

## [0.4.0](https://github.com/Wildhoney/Chizu/compare/v0.3.0...v0.4.0) (2026-05-07)

### ⚠ BREAKING CHANGES

- **scope:** drop ScopeCarrier, take scope name string directly

- **scope:** drop ScopeCarrier, take scope name string directly ([1538ae5](https://github.com/Wildhoney/Chizu/commit/1538ae51b51dbf54f13afa6454e851641a1a2998))

## [0.3.0](https://github.com/Wildhoney/Chizu/compare/v0.2.72...v0.3.0) (2026-05-07)

### ⚠ BREAKING CHANGES

- **error:** replace <Error> boundary with Lifecycle.Fault broadcast

- **error:** replace <Error> boundary with Lifecycle.Fault broadcast ([e52555b](https://github.com/Wildhoney/Chizu/commit/e52555b29a320a5b7870fbd9b7015baf903d7895))

## [0.2.72](https://github.com/Wildhoney/Chizu/compare/v0.2.71...v0.2.72) (2026-03-06)

### Features

- **types:** add Features and Nodes utility types with Property symbol keys ([b2d9f72](https://github.com/Wildhoney/Chizu/commit/b2d9f72394ba5bdb9781765c40e6a37790ccd0e5))

### Bug Fixes

- **hooks:** discard implicit return values from produce callbacks ([dfa02b4](https://github.com/Wildhoney/Chizu/commit/dfa02b4e37cdfb657c9826e98baef48e2095e16b))

## [0.2.71](https://github.com/Wildhoney/Chizu/compare/v0.2.70...v0.2.71) (2026-02-25)

### Features

- added concept of features and made dispatch awaitable ([8049db3](https://github.com/Wildhoney/Chizu/commit/8049db30054b9899572de67b1a53ed4327b0bb67))

## [0.2.70](https://github.com/Wildhoney/Chizu/compare/v0.2.69...v0.2.70) (2026-02-24)

## [0.2.69](https://github.com/Wildhoney/Chizu/compare/v0.2.68...v0.2.69) (2026-02-24)

## [0.2.68](https://github.com/Wildhoney/Chizu/compare/v0.2.67...v0.2.68) (2026-02-24)

### Features

- **hooks:** convert lifecycle actions to factory functions for per-component regulation ([2cd078f](https://github.com/Wildhoney/Chizu/commit/2cd078f20920e3da8839129bca1e07fdeaf5b148))

## [0.2.67](https://github.com/Wildhoney/Chizu/compare/v0.2.66...v0.2.67) (2026-02-23)

## [0.2.66](https://github.com/Wildhoney/Chizu/compare/v0.2.63...v0.2.66) (2026-02-23)

### Features

- **hooks:** add multicast cached replay on mount and document deduplication patterns ([f95babe](https://github.com/Wildhoney/Chizu/commit/f95babed564e0942d8aa319340b58158c3d57186))
- **hooks:** add peek() for synchronous reads and JSX consume() on actions tuple ([e0d2e85](https://github.com/Wildhoney/Chizu/commit/e0d2e857bb8fe6b7c4ee1a4489bd6258c73b6e58))
- **utils:** add signal-aware poll() utility and make sleep() signal arg explicit ([ab71164](https://github.com/Wildhoney/Chizu/commit/ab7116410532fc412d3de41dac100a60edae4f9a))

### Bug Fixes

- replay broadcast values for useAction handlers without consume ([576e705](https://github.com/Wildhoney/Chizu/commit/576e705dbde193452090ad95d4a629f53689ca26))
- **types:** allow action-based derive with void model by removing never guard ([4dde105](https://github.com/Wildhoney/Chizu/commit/4dde105567413e58ae30326604502342a5836109))

## [0.2.65](https://github.com/Wildhoney/Chizu/compare/v0.2.63...v0.2.65) (2026-02-13)

### Bug Fixes

- replay broadcast values for useAction handlers without consume ([576e705](https://github.com/Wildhoney/Chizu/commit/576e705dbde193452090ad95d4a629f53689ca26))

## [0.2.64](https://github.com/Wildhoney/Chizu/compare/v0.2.63...v0.2.64) (2026-02-12)

### Bug Fixes

- replay broadcast values for useAction handlers without consume ([576e705](https://github.com/Wildhoney/Chizu/commit/576e705dbde193452090ad95d4a629f53689ca26))

## [0.2.63](https://github.com/Wildhoney/Chizu/compare/v0.2.60...v0.2.63) (2026-02-12)

### Features

- **hooks:** support void actions type parameter in useActions with void,void defaults ([e23fbd0](https://github.com/Wildhoney/Chizu/commit/e23fbd0df671e6973e841d7dab75284221795c72))
- **scope:** derive withScope wrapper name from wrapped component ([2652691](https://github.com/Wildhoney/Chizu/commit/265269122c9b2ec9cdf7c25ced4ee07a0c016578))
- support void model type in useActions for stateless action-only components ([fa83b1c](https://github.com/Wildhoney/Chizu/commit/fa83b1cb76f6727e7fd7ea756ee1e66120dcf86c))

## [0.2.62](https://github.com/Wildhoney/Chizu/compare/v0.2.60...v0.2.62) (2026-02-11)

### Features

- **scope:** derive withScope wrapper name from wrapped component ([2652691](https://github.com/Wildhoney/Chizu/commit/265269122c9b2ec9cdf7c25ced4ee07a0c016578))
- support void model type in useActions for stateless action-only components ([fa83b1c](https://github.com/Wildhoney/Chizu/commit/fa83b1cb76f6727e7fd7ea756ee1e66120dcf86c))

## [0.2.61](https://github.com/Wildhoney/Chizu/compare/v0.2.60...v0.2.61) (2026-02-11)

### Features

- support void model type in useActions for stateless action-only components ([fa83b1c](https://github.com/Wildhoney/Chizu/commit/fa83b1cb76f6727e7fd7ea756ee1e66120dcf86c))

## [0.2.60](https://github.com/Wildhoney/Chizu/compare/v0.2.59...v0.2.60) (2026-02-11)

### Features

- read context.model from state ref to prevent stale closure reads ([448e827](https://github.com/Wildhoney/Chizu/commit/448e827dfa96a703fc1d788a81188c1587e08f07))

## [0.2.59](https://github.com/Wildhoney/Chizu/compare/v0.2.58...v0.2.59) (2026-02-11)

### Features

- support dot-notation for nested action namespaces in Handlers type ([75013c0](https://github.com/Wildhoney/Chizu/commit/75013c0b3e58a67ea1e761b6f68609e5a3eb5ee1))

## [0.2.58](https://github.com/Wildhoney/Chizu/compare/v0.2.56...v0.2.58) (2026-02-11)

### Features

- **hooks:** add context.actions.consume for handler-side broadcast/multicast reads ([3ab2bc5](https://github.com/Wildhoney/Chizu/commit/3ab2bc5475303044fd1da6f47eaa9629d527f3a2))
- **types:** support dot-notated nested actions in Handlers HKT ([a56cae9](https://github.com/Wildhoney/Chizu/commit/a56cae94559563eb17d0ab07f13f0a92a5b48462))

## [0.2.57](https://github.com/Wildhoney/Chizu/compare/v0.2.56...v0.2.57) (2026-02-11)

### Features

- **hooks:** add context.actions.consume for handler-side broadcast/multicast reads ([3ab2bc5](https://github.com/Wildhoney/Chizu/commit/3ab2bc5475303044fd1da6f47eaa9629d527f3a2))

## [0.2.56](https://github.com/Wildhoney/Chizu/compare/v0.2.55...v0.2.56) (2026-02-11)

### Features

- added withScope HOC for multicast actions ([2da9708](https://github.com/Wildhoney/Chizu/commit/2da9708e2371089a21f2018ee72dab6496a96208))

## [0.2.55](https://github.com/Wildhoney/Chizu/compare/v0.2.54...v0.2.55) (2026-02-11)

### Features

- **deps:** update immertation to ^0.1.26 ([65fa1e8](https://github.com/Wildhoney/Chizu/commit/65fa1e8a5743c03bdd286fbcbe3ee49ec692a430))

## [0.2.54](https://github.com/Wildhoney/Chizu/compare/v0.2.52...v0.2.54) (2026-02-11)

### Features

- **cache:** add Entry factory with cacheable/invalidate on context.actions ([05d2043](https://github.com/Wildhoney/Chizu/commit/05d20437279766591583a16373c98f35ac786ec9))
- **rehydrate:** add typed Id<M, C> store factory and context.actions.invalidate for rehydration snapshots ([2327fb9](https://github.com/Wildhoney/Chizu/commit/2327fb93b0eaac6b209a538a79e08d6eacd57064))

## [0.2.53](https://github.com/Wildhoney/Chizu/compare/v0.2.52...v0.2.53) (2026-02-11)

### Features

- **rehydrate:** add typed Id<M, C> store factory and context.actions.invalidate for rehydration snapshots ([2327fb9](https://github.com/Wildhoney/Chizu/commit/2327fb93b0eaac6b209a538a79e08d6eacd57064))

## [0.2.52](https://github.com/Wildhoney/Chizu/compare/v0.2.49...v0.2.52) (2026-02-10)

### Features

- add cache layer with cacheable, invalidate, and model initialisation ([5f5ea22](https://github.com/Wildhoney/Chizu/commit/5f5ea221674563fdeea0387205013bad7990e589))
- **annotate:** add standalone annotate function for initial model Op states ([2cf7e10](https://github.com/Wildhoney/Chizu/commit/2cf7e10b9a7cbf9660579d9231cfecf0a7de9fc3))
- replace cache layer with rehydration for persisting state across unmount/remount cycles ([f0c9330](https://github.com/Wildhoney/Chizu/commit/f0c93306b971d2d729595b5f0932e7148315e6f2))

## [0.2.51](https://github.com/Wildhoney/Chizu/compare/v0.2.49...v0.2.51) (2026-02-10)

### Features

- add cache layer with cacheable, invalidate, and model initialisation ([5f5ea22](https://github.com/Wildhoney/Chizu/commit/5f5ea221674563fdeea0387205013bad7990e589))
- **annotate:** add standalone annotate function for initial model Op states ([2cf7e10](https://github.com/Wildhoney/Chizu/commit/2cf7e10b9a7cbf9660579d9231cfecf0a7de9fc3))

## [0.2.50](https://github.com/Wildhoney/Chizu/compare/v0.2.49...v0.2.50) (2026-02-10)

### Features

- add cache layer with cacheable, invalidate, and model initialisation ([5f5ea22](https://github.com/Wildhoney/Chizu/commit/5f5ea221674563fdeea0387205013bad7990e589))

## [0.2.49](https://github.com/Wildhoney/Chizu/compare/v0.2.48...v0.2.49) (2026-02-05)

## [0.2.48](https://github.com/Wildhoney/Chizu/compare/v0.2.47...v0.2.48) (2026-02-05)

## [0.2.47](https://github.com/Wildhoney/Chizu/compare/v0.2.27...v0.2.47) (2026-02-05)

### Features

- abort in-flight actions on unmount, add own() methods, unify to array notation ([7eca071](https://github.com/Wildhoney/Chizu/commit/7eca071d78c319c28ec5684760e47e27430d2f27))
- add consume() method for subscribing to distributed action values ([0594110](https://github.com/Wildhoney/Chizu/commit/0594110bd90d73a90b4cc978d8267f934491a4e9))
- add Lifecycle.Element for element capture events with channeled subscriptions ([fac3f0f](https://github.com/Wildhoney/Chizu/commit/fac3f0ff21e6183d5e102b6bfe8bcb764e0a2edd))
- add nested Actions.Multicast pattern with typed dispatch overloads ([e4ca34d](https://github.com/Wildhoney/Chizu/commit/e4ca34d591b2c02ff8a4f440bb6440c7e6b048b9))
- add tuple type pattern for useAction and useActions hooks ([99ba7d4](https://github.com/Wildhoney/Chizu/commit/99ba7d4c3a11b4c4049d9abfbef7746589c76645))
- add With.Filter helper and organize utils under With namespace ([2d4dcd3](https://github.com/Wildhoney/Chizu/commit/2d4dcd34d8b1e12b97001484d2f7631096ef08e5))
- added + updated decorators ([5e13c71](https://github.com/Wildhoney/Chizu/commit/5e13c719db4cbb9aedd06dab1f2825534b4794c7))
- added <Visitor /> example for real-time data ([719495b](https://github.com/Wildhoney/Chizu/commit/719495bbef0b6f670720fe8e69e21127a0cf6db9))
- added action decorators and updated README ([e429fb9](https://github.com/Wildhoney/Chizu/commit/e429fb9da2163edec18fbb63d049fa2bfd0a574a))
- added actions.useReactive hook ([1e8deed](https://github.com/Wildhoney/Chizu/commit/1e8deed417e8c1fe47b62a035e81bbd18ea75ae6))
- added Bound function for simple assignments ([22235aa](https://github.com/Wildhoney/Chizu/commit/22235aa57738fd67ff448b797f9725e39835729e))
- added checksum util fn and documented the util fns ([2c48ebb](https://github.com/Wildhoney/Chizu/commit/2c48ebb121edfcbfb673af4b117da2f5ad1e391a))
- added decorators + updated README ([8d72c6d](https://github.com/Wildhoney/Chizu/commit/8d72c6d24ea1e8694ca544549e25964f216ad8db))
- added error handling context ([01c1510](https://github.com/Wildhoney/Chizu/commit/01c15105f0755be06b954405d8c86e9542c68473))
- added initial decorator example ([0d1d184](https://github.com/Wildhoney/Chizu/commit/0d1d184933cead30e580be5fcaddfec419e1869a))
- added integration test for the counter example ([56e557b](https://github.com/Wildhoney/Chizu/commit/56e557b3bc046a736f35d849e4e9bea0f426e5db))
- added late dispatching for useAction(DistributedAction) ([b46bbb8](https://github.com/Wildhoney/Chizu/commit/b46bbb8ce7589f987c86a88123078d417fae71a2))
- added Lifecycle.Update with diff ([53a8c45](https://github.com/Wildhoney/Chizu/commit/53a8c45c4479440534dfe39c3b8a60940e87ac66))
- added rulebook with associated integration tests + rulebook ([275b136](https://github.com/Wildhoney/Chizu/commit/275b136960b956e721fb1804d8ec44984753915b))
- added the ability to dispatch events using partial object matching ([6f05cb6](https://github.com/Wildhoney/Chizu/commit/6f05cb66b4ef75c75896953da28b8fc717527c85))
- changed the channeled actions approach ([d9b699b](https://github.com/Wildhoney/Chizu/commit/d9b699b89817cd7646cdfc5b9b70d579c27bb23e))
- changed the interface of the regulator object ([58f755c](https://github.com/Wildhoney/Chizu/commit/58f755cd52e637df8244d7c6506e2f637c1d69f3))
- implement real Immertation inspect for consume() and rename ConsumeRenderer to Partition ([d7a6292](https://github.com/Wildhoney/Chizu/commit/d7a62924daeaa59a5cb11748f658f2e144a67464))
- improved the appearance of the example ([a766be1](https://github.com/Wildhoney/Chizu/commit/a766be105ecdef38213242ba6cd492ec6812d6c6))
- improved the typing of the useAction fn ([b64104c](https://github.com/Wildhoney/Chizu/commit/b64104ca6b71fd8ce514074321f9d8c2438eb7df))
- improved typings around the actions ([493dee6](https://github.com/Wildhoney/Chizu/commit/493dee6c6ee2b3931e331f2afee13d827a90ca5a))
- integrated immeration ([11641a7](https://github.com/Wildhoney/Chizu/commit/11641a796066ad5791de694f7576578b946e09dd))
- new implementation for the annotations ([eec20b2](https://github.com/Wildhoney/Chizu/commit/eec20b28483f6967a4df746e5bb79255934f7c8d))
- re-added the model stateful and stateless concept ([0beb7c4](https://github.com/Wildhoney/Chizu/commit/0beb7c4a68cfbadf5c038495e2c2765ca4d68430))
- regulator class ([986303f](https://github.com/Wildhoney/Chizu/commit/986303ff9433c5f20f475f54bee2f09ff0f5d609))
- removed the regulator class in favour of Set<Task> ([9301202](https://github.com/Wildhoney/Chizu/commit/930120238fef57c10782d840b39cc98e026a38a1))
- simplified the README ([aee1d16](https://github.com/Wildhoney/Chizu/commit/aee1d1675014ed30db9cb1626ad293b429212773))
- support variadic arguments in regulator matching methods ([6a3ff7a](https://github.com/Wildhoney/Chizu/commit/6a3ff7a23e79ff2fd82ea5643e4168827f94617a))
- supporting async and generator actions ([abbf73c](https://github.com/Wildhoney/Chizu/commit/abbf73c5e046235d563ee25ea624a9f4b7b6b723))
- supporting custom error classes ([b1ce948](https://github.com/Wildhoney/Chizu/commit/b1ce94813455a930734c271392cb3f2e7ae33396))
- update api to improve readability ([ea2cda6](https://github.com/Wildhoney/Chizu/commit/ea2cda6d3e57c4b4e46f2a4e7143f56a4e630cf8))
- update Immertation to 0.1.21 and set yarn as package manager ([d8671a0](https://github.com/Wildhoney/Chizu/commit/d8671a05669bde98e680f688863f5f959d5339bf))
- updated inteface for the regulator ([503923e](https://github.com/Wildhoney/Chizu/commit/503923eed9047ec5933eff7a75cb5af0c294e37e))
- updated the api for the reactive() decorator ([51a0f14](https://github.com/Wildhoney/Chizu/commit/51a0f1404d57a830d42711159a571e77dc993815))
- upgraded to latest immertation version ([24ebde1](https://github.com/Wildhoney/Chizu/commit/24ebde1d902f638edf20ab895cc4687cc9bb3691))
- use `useEffectEvent` for the `useAction` hook ([a75a145](https://github.com/Wildhoney/Chizu/commit/a75a145f484d9b9b732253457a097875b1af6d66))
- using ref to allow for sync actions ([5bc897d](https://github.com/Wildhoney/Chizu/commit/5bc897d34cbad4d4ff28b2dea406334727c8ac8c))

### Bug Fixes

- bug with the strings as action names ([f4cd779](https://github.com/Wildhoney/Chizu/commit/f4cd77992549de13330ce1fd924e40a6b8735de0))
- emitting Lifecycle.Node ([bf58324](https://github.com/Wildhoney/Chizu/commit/bf583242534fde5f5437509481dab6ce11639bcc))
- playwright ci ([07e84e1](https://github.com/Wildhoney/Chizu/commit/07e84e133df215061cd9477acc6a867acb382f7f))
- tests + lint + typecheck ([5fe94ac](https://github.com/Wildhoney/Chizu/commit/5fe94ac97d57f8954997b0156b20e00a2c2894d7))
- tests + lint + typecheck ([91678c3](https://github.com/Wildhoney/Chizu/commit/91678c36546799208a857d487e21938ed85f6f01))
- update GitHub URLs and fix example build configuration ([d2027d2](https://github.com/Wildhoney/Chizu/commit/d2027d2991cf5428cd0dbb50019dc74b7c24c500))

## [0.2.46](https://github.com/Wildhoney/Chizu/compare/v0.2.43...v0.2.46) (2026-01-23)

### Features

- abort in-flight actions on unmount, add own() methods, unify to array notation ([ca07aea](https://github.com/Wildhoney/Chizu/commit/ca07aea3d6dc8be2ffe169f6837b01202ca9f7b1))
- add consume() method for subscribing to distributed action values ([76b6984](https://github.com/Wildhoney/Chizu/commit/76b698443abebcbe5e480c002ec844ed0463b834))
- add tuple type pattern for useAction and useActions hooks ([739677f](https://github.com/Wildhoney/Chizu/commit/739677f6902da72470c296f43d1da624b4d3e1bb))
- add With.Filter helper and organize utils under With namespace ([a98e436](https://github.com/Wildhoney/Chizu/commit/a98e43600f8657d952849d8823d7309c5691efc7))
- added actions.useReactive hook ([7998ae6](https://github.com/Wildhoney/Chizu/commit/7998ae634351672933729fc8794c7e23eb6b0ad4))
- added Bound function for simple assignments ([f4c0a1f](https://github.com/Wildhoney/Chizu/commit/f4c0a1fcac5237828e8a0a43f98acd5d5f467ad1))
- added late dispatching for useAction(DistributedAction) ([4b0fc83](https://github.com/Wildhoney/Chizu/commit/4b0fc8366c7d2241ef85ca742e938e607f240407))
- added Lifecycle.Update with diff ([6e465dd](https://github.com/Wildhoney/Chizu/commit/6e465dd7859b1cf950295c36aa8c2f14c23873d3))
- added rulebook with associated integration tests + rulebook ([277ca0a](https://github.com/Wildhoney/Chizu/commit/277ca0aba3946ff0842f35b56e2469d8574c6ebf))
- added the ability to dispatch events using partial object matching ([1550b1d](https://github.com/Wildhoney/Chizu/commit/1550b1d2ad56e7b18a130be103525f2848322205))
- changed the channeled actions approach ([50c2df1](https://github.com/Wildhoney/Chizu/commit/50c2df1981c11091573d2b05390f78523ffbf10c))
- implement real Immertation inspect for consume() and rename ConsumeRenderer to Partition ([89a032e](https://github.com/Wildhoney/Chizu/commit/89a032eb3fbe9088d85c9331011a0de4802e9935))
- removed the regulator class in favour of Set<Task> ([1ce0389](https://github.com/Wildhoney/Chizu/commit/1ce0389329e0812360de2128270dd6383ce23d30))
- simplified the README ([7a5c9a8](https://github.com/Wildhoney/Chizu/commit/7a5c9a8dcd0d5bd003012708d331ae31529ea025))
- update api to improve readability ([fd71a64](https://github.com/Wildhoney/Chizu/commit/fd71a6454aec40f5b217b94529b541a80e103914))

## [0.2.45](https://github.com/Wildhoney/Chizu/compare/v0.2.43...v0.2.45) (2026-01-23)

### Features

- abort in-flight actions on unmount, add own() methods, unify to array notation ([ca07aea](https://github.com/Wildhoney/Chizu/commit/ca07aea3d6dc8be2ffe169f6837b01202ca9f7b1))
- add consume() method for subscribing to distributed action values ([76b6984](https://github.com/Wildhoney/Chizu/commit/76b698443abebcbe5e480c002ec844ed0463b834))
- add tuple type pattern for useAction and useActions hooks ([739677f](https://github.com/Wildhoney/Chizu/commit/739677f6902da72470c296f43d1da624b4d3e1bb))
- add With.Filter helper and organize utils under With namespace ([a98e436](https://github.com/Wildhoney/Chizu/commit/a98e43600f8657d952849d8823d7309c5691efc7))
- added actions.useReactive hook ([7998ae6](https://github.com/Wildhoney/Chizu/commit/7998ae634351672933729fc8794c7e23eb6b0ad4))
- added Bound function for simple assignments ([f4c0a1f](https://github.com/Wildhoney/Chizu/commit/f4c0a1fcac5237828e8a0a43f98acd5d5f467ad1))
- added late dispatching for useAction(DistributedAction) ([4b0fc83](https://github.com/Wildhoney/Chizu/commit/4b0fc8366c7d2241ef85ca742e938e607f240407))
- added Lifecycle.Update with diff ([6e465dd](https://github.com/Wildhoney/Chizu/commit/6e465dd7859b1cf950295c36aa8c2f14c23873d3))
- added rulebook with associated integration tests + rulebook ([277ca0a](https://github.com/Wildhoney/Chizu/commit/277ca0aba3946ff0842f35b56e2469d8574c6ebf))
- added the ability to dispatch events using partial object matching ([1550b1d](https://github.com/Wildhoney/Chizu/commit/1550b1d2ad56e7b18a130be103525f2848322205))
- changed the channeled actions approach ([50c2df1](https://github.com/Wildhoney/Chizu/commit/50c2df1981c11091573d2b05390f78523ffbf10c))
- implement real Immertation inspect for consume() and rename ConsumeRenderer to Partition ([89a032e](https://github.com/Wildhoney/Chizu/commit/89a032eb3fbe9088d85c9331011a0de4802e9935))
- removed the regulator class in favour of Set<Task> ([1ce0389](https://github.com/Wildhoney/Chizu/commit/1ce0389329e0812360de2128270dd6383ce23d30))
- simplified the README ([7a5c9a8](https://github.com/Wildhoney/Chizu/commit/7a5c9a8dcd0d5bd003012708d331ae31529ea025))
- update api to improve readability ([fd71a64](https://github.com/Wildhoney/Chizu/commit/fd71a6454aec40f5b217b94529b541a80e103914))

## [0.2.44](https://github.com/Wildhoney/Chizu/compare/v0.2.43...v0.2.44) (2026-01-05)

### Features

- abort in-flight actions on unmount, add own() methods, unify to array notation ([ca07aea](https://github.com/Wildhoney/Chizu/commit/ca07aea3d6dc8be2ffe169f6837b01202ca9f7b1))
- add consume() method for subscribing to distributed action values ([76b6984](https://github.com/Wildhoney/Chizu/commit/76b698443abebcbe5e480c002ec844ed0463b834))

## [0.2.43](https://github.com/Wildhoney/Chizu/compare/v0.2.42...v0.2.43) (2025-12-30)

## [0.2.42](https://github.com/Wildhoney/Chizu/compare/v0.2.41...v0.2.42) (2025-12-29)

## [0.2.41](https://github.com/Wildhoney/Chizu/compare/v0.2.40...v0.2.41) (2025-12-29)

### Features

- added <Visitor /> example for real-time data ([061534f](https://github.com/Wildhoney/Chizu/commit/061534f98851fc777ea4cf3ffc069cfae6994b72))
- changed the interface of the regulator object ([ee1a2b4](https://github.com/Wildhoney/Chizu/commit/ee1a2b4f4356aac553d72ad253488cfeef7c9564))
- regulator class ([2c84e3a](https://github.com/Wildhoney/Chizu/commit/2c84e3a3f884a52837f3a7ce069cab04fdda594b))
- support variadic arguments in regulator matching methods ([9e9351a](https://github.com/Wildhoney/Chizu/commit/9e9351aeea950f7ce2e043d1b100c189e01715d0))
- update Immertation to 0.1.21 and set yarn as package manager ([517fa74](https://github.com/Wildhoney/Chizu/commit/517fa74e6da8ec4bdcc5cde09f75265e507a5572))
- updated inteface for the regulator ([6fd5fd3](https://github.com/Wildhoney/Chizu/commit/6fd5fd3ff7369d5c65c88237e94d46178636bfa0))
- updated the api for the reactive() decorator ([537f17b](https://github.com/Wildhoney/Chizu/commit/537f17b911705080ad2559f6a747694b5aec5857))

## [0.2.40](https://github.com/Wildhoney/Chizu/compare/v0.2.39...v0.2.40) (2025-12-18)

## [0.2.39](https://github.com/Wildhoney/Chizu/compare/v0.2.38...v0.2.39) (2025-12-18)

### Features

- added + updated decorators ([a74fb58](https://github.com/Wildhoney/Chizu/commit/a74fb58c828e826564bc9d3217f2841723351342))
- added checksum util fn and documented the util fns ([97ddc71](https://github.com/Wildhoney/Chizu/commit/97ddc71c1a94a1c0955fcf1e50c6e27e41b54d47))
- supporting custom error classes ([05131ab](https://github.com/Wildhoney/Chizu/commit/05131aba762f534e1596b8a8b68e2681ed565537))

## [0.2.38](https://github.com/Wildhoney/Chizu/compare/v0.2.37...v0.2.38) (2025-12-17)

## [0.2.37](https://github.com/Wildhoney/Chizu/compare/v0.2.36...v0.2.37) (2025-12-17)

### Features

- added decorators + updated README ([081162f](https://github.com/Wildhoney/Chizu/commit/081162ff27abcf9625b4fa4d0b987a8f1b9092f3))

### Bug Fixes

- playwright ci ([6dc3621](https://github.com/Wildhoney/Chizu/commit/6dc3621434ad617c15bb8789f21bc6a2572598d6))

## [0.2.36](https://github.com/Wildhoney/Chizu/compare/v0.2.35...v0.2.36) (2025-12-16)

## [0.2.35](https://github.com/Wildhoney/Chizu/compare/v0.2.34...v0.2.35) (2025-12-16)

### Features

- added action decorators and updated README ([fddc63b](https://github.com/Wildhoney/Chizu/commit/fddc63b1e064e24c6f4c587cf236719380ccab25))

## [0.2.34](https://github.com/Wildhoney/Chizu/compare/v0.2.33...v0.2.34) (2025-12-13)

### Bug Fixes

- emitting Lifecycle.Node ([518ce7c](https://github.com/Wildhoney/Chizu/commit/518ce7cc594fb2b32b9782719187f61117207409))

## [0.2.33](https://github.com/Wildhoney/Chizu/compare/v0.2.32...v0.2.33) (2025-12-13)

## [0.2.32](https://github.com/Wildhoney/Chizu/compare/v0.2.31...v0.2.32) (2025-12-13)

## [0.2.31](https://github.com/Wildhoney/Chizu/compare/v0.2.30...v0.2.31) (2025-12-13)

## [0.2.30](https://github.com/Wildhoney/Chizu/compare/v0.2.29...v0.2.30) (2025-12-12)

## [0.2.29](https://github.com/Wildhoney/Chizu/compare/v0.2.28...v0.2.29) (2025-12-12)

### Features

- improved the typing of the useAction fn ([719e00c](https://github.com/Wildhoney/Chizu/commit/719e00c567bdfcb08181784bb1d4c29cb602f299))

## [0.2.28](https://github.com/Wildhoney/Chizu/compare/v0.2.27...v0.2.28) (2025-12-09)

### Features

- added error handling context ([01c1510](https://github.com/Wildhoney/Chizu/commit/01c15105f0755be06b954405d8c86e9542c68473))
- added initial decorator example ([197889d](https://github.com/Wildhoney/Chizu/commit/197889df420d96eef5afc753a5287ebd6f949d5f))
- added integration test for the counter example ([56e557b](https://github.com/Wildhoney/Chizu/commit/56e557b3bc046a736f35d849e4e9bea0f426e5db))
- improved the appearance of the example ([1206d16](https://github.com/Wildhoney/Chizu/commit/1206d165c8c432a8b5d95ce1de5caa600b655ec1))
- improved typings around the actions ([2cf3e05](https://github.com/Wildhoney/Chizu/commit/2cf3e055cadb88cb944f78274a4cef6ca0547be2))
- integrated immeration ([11641a7](https://github.com/Wildhoney/Chizu/commit/11641a796066ad5791de694f7576578b946e09dd))
- new implementation for the annotations ([eec20b2](https://github.com/Wildhoney/Chizu/commit/eec20b28483f6967a4df746e5bb79255934f7c8d))
- re-added the model stateful and stateless concept ([0beb7c4](https://github.com/Wildhoney/Chizu/commit/0beb7c4a68cfbadf5c038495e2c2765ca4d68430))
- supporting async and generator actions ([abbf73c](https://github.com/Wildhoney/Chizu/commit/abbf73c5e046235d563ee25ea624a9f4b7b6b723))
- upgraded to latest immertation version ([6b3410f](https://github.com/Wildhoney/Chizu/commit/6b3410ff88f6e0cba2649965031f4e3d571edee6))
- use `useEffectEvent` for the `useAction` hook ([a75a145](https://github.com/Wildhoney/Chizu/commit/a75a145f484d9b9b732253457a097875b1af6d66))
- using ref to allow for sync actions ([5bc897d](https://github.com/Wildhoney/Chizu/commit/5bc897d34cbad4d4ff28b2dea406334727c8ac8c))

### Bug Fixes

- bug with the strings as action names ([f4cd779](https://github.com/Wildhoney/Chizu/commit/f4cd77992549de13330ce1fd924e40a6b8735de0))
- tests + lint + typecheck ([5fe94ac](https://github.com/Wildhoney/Chizu/commit/5fe94ac97d57f8954997b0156b20e00a2c2894d7))
- tests + lint + typecheck ([91678c3](https://github.com/Wildhoney/Chizu/commit/91678c36546799208a857d487e21938ed85f6f01))
- update GitHub URLs and fix example build configuration ([3175107](https://github.com/Wildhoney/Chizu/commit/31751074e15729c77e0ca685072ec93919e9c60c))

## [0.2.27](https://github.com/Wildhoney/Marea/compare/v0.2.26...v0.2.27) (2025-07-09)

### Bug Fixes

- issue with passing the props ([72cee6d](https://github.com/Wildhoney/Marea/commit/72cee6d56507c9adc1b2db91a5702b7170fa07c9))

## [0.2.26](https://github.com/Wildhoney/Marea/compare/v0.2.25...v0.2.26) (2025-07-09)

## [0.2.25](https://github.com/Wildhoney/Marea/compare/v0.2.24...v0.2.25) (2025-06-05)

### Features

- allowed other return types in actions ([9dd2be8](https://github.com/Wildhoney/Marea/commit/9dd2be86ce456a3d8a852766513103d440ce6585))

## [0.2.24](https://github.com/Wildhoney/Marea/compare/v0.2.23...v0.2.24) (2025-06-05)

### Features

- added passive flag ([7406bea](https://github.com/Wildhoney/Marea/commit/7406bea5ef4359cc163dce8e4fa22942b0ae4d52))

### Bug Fixes

- typings for the context values ([a13f43b](https://github.com/Wildhoney/Marea/commit/a13f43b5fc2c102535507783f71703f414f54019))

## [0.2.23](https://github.com/Wildhoney/Marea/compare/v0.2.22...v0.2.23) (2025-06-03)

### Features

- added ability to retrieve context values within actions ([92f7f75](https://github.com/Wildhoney/Marea/commit/92f7f75ffcb13b4ef2058f85ef769d37d4025478))

## [0.2.22](https://github.com/Wildhoney/Marea/compare/v0.2.21...v0.2.22) (2025-06-02)

## [0.2.21](https://github.com/Wildhoney/Marea/compare/v0.2.20...v0.2.21) (2025-06-01)

### Features

- added concept of render channels ([c9f56d0](https://github.com/Wildhoney/Marea/commit/c9f56d01b86d14d9256c26f0661b8c326226b871))
- moved reporting of view errors into the associated model ([c3538cb](https://github.com/Wildhoney/Marea/commit/c3538cbea081a154d3f45cdec74d0455f377f3b4))

## [0.2.20](https://github.com/Wildhoney/Marea/compare/v0.2.19...v0.2.20) (2025-05-30)

## [0.2.19](https://github.com/Wildhoney/Marea/compare/v0.2.18...v0.2.19) (2025-05-30)

### Features

- improved the error handling significantly ([910fae0](https://github.com/Wildhoney/Marea/commit/910fae069772ebb763f2eea1bb793b3ba3c685e7))

## [0.2.18](https://github.com/Wildhoney/Marea/compare/v0.2.17...v0.2.18) (2025-05-30)

### Bug Fixes

- added module context ([dacf6fa](https://github.com/Wildhoney/Marea/commit/dacf6fa13d09e332a8e441dddc2696e98c0f8ddb))

## [0.2.17](https://github.com/Wildhoney/Marea/compare/v0.2.16...v0.2.17) (2025-05-30)

### Features

- added useModule for use within a module tree ([58d0409](https://github.com/Wildhoney/Marea/commit/58d0409172551952f945d1f6f1260103090cc311))

## [0.2.16](https://github.com/Wildhoney/Marea/compare/v0.2.15...v0.2.16) (2025-05-29)

### Features

- reintroduced the error handling ([ae73abf](https://github.com/Wildhoney/Marea/commit/ae73abf744928a8184c3f695f0af174b54ce5142))

## [0.2.15](https://github.com/Wildhoney/Marea/compare/v0.2.14...v0.2.15) (2025-05-29)

## [0.2.14](https://github.com/Wildhoney/Marea/compare/v0.2.13...v0.2.14) (2025-05-29)

## [0.2.13](https://github.com/Wildhoney/Marea/compare/v0.2.12...v0.2.13) (2025-05-29)

### Features

- changed the syntax of the associated views ([07c099c](https://github.com/Wildhoney/Marea/commit/07c099c8840f5c6e109bb6e8ec2eac8b2e0c437d))

## [0.2.12](https://github.com/Wildhoney/Marea/compare/v0.2.11...v0.2.12) (2025-05-28)

### Features

- added use props hook with props accessor ([4ac08e7](https://github.com/Wildhoney/Marea/commit/4ac08e7d57b2f40127031491c915d6dc2427454d))

## [0.2.11](https://github.com/Wildhoney/Marea/compare/v0.2.10...v0.2.11) (2025-05-28)

## [0.2.10](https://github.com/Wildhoney/Marea/compare/v0.2.9...v0.2.10) (2025-05-28)

### Bug Fixes

- rerendering the tree on prop changes ([d185694](https://github.com/Wildhoney/Marea/commit/d1856945b61d235eaf6a804692faac2f46f74d6e))

## [0.2.9](https://github.com/Wildhoney/Marea/compare/v0.2.8...v0.2.9) (2025-05-28)

## [0.2.8](https://github.com/Wildhoney/Marea/compare/v0.2.7...v0.2.8) (2025-05-27)

### Features

- introduced optimised versions of useLayoutEffect and useMemo to prevent strict mode quirkiness ([6f9cf13](https://github.com/Wildhoney/Marea/commit/6f9cf138f9c857681ae3e37296a407ae622c2851))

## [0.2.7](https://github.com/Wildhoney/Marea/compare/v0.2.6...v0.2.7) (2025-05-21)

### Features

- removed handlers and attributes and instead use props directly ([2c16900](https://github.com/Wildhoney/Marea/commit/2c1690081b3e06437851e6bad4671899da2ca8e6))
- removed passing props and routes to derive handler ([ebe5f3c](https://github.com/Wildhoney/Marea/commit/ebe5f3c1c9f0901c0a98444346de6aeb087fbce4))

## [0.2.6](https://github.com/Wildhoney/Marea/compare/v0.2.5...v0.2.6) (2025-05-20)

### Features

- allow controller functions not to be async generators ([c647edc](https://github.com/Wildhoney/Marea/commit/c647edc92f0bb8be1a8ecf753079e6d4a7e6c454))

## [0.2.5](https://github.com/Wildhoney/Marea/compare/v0.2.4...v0.2.5) (2025-05-20)

### Features

- custom elements have display: contents ([b9bd4c5](https://github.com/Wildhoney/Marea/commit/b9bd4c58329efbeb0bff2b565bef12ea16d803e8))

## [0.2.4](https://github.com/Wildhoney/Marea/compare/v0.2.3...v0.2.4) (2025-05-20)

### Features

- improved the approach to typings ([e1b9785](https://github.com/Wildhoney/Marea/commit/e1b978549503917ce994893562d9afd6c4d66955))

## [0.2.3](https://github.com/Wildhoney/Marea/compare/v0.2.2...v0.2.3) (2025-05-16)

## [0.2.2](https://github.com/Wildhoney/Marea/compare/v0.2.1...v0.2.2) (2025-05-15)

### Features

- added standard-version for deploying ([bcc7ca4](https://github.com/Wildhoney/Marea/commit/bcc7ca42e59fee8c6bb520fc8a0fc3913c76336e))

### [0.2.1](https://github.com/Wildhoney/Marea/compare/v0.2.0...v0.2.1) (2025-05-15)
