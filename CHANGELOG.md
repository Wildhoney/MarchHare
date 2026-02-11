# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

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
