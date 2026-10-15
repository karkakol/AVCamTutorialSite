# Swift glossary audit

Date: 15 Oct 2026. File: `src/lib/swift-notes.mjs` (69 entries). Build and `npm run validate` pass (0 errors, 0 warnings).

## Changed entries (30)

| id | problem | fix |
|---|---|---|
| ternary | Text described a formatting habit. The regex matched optional types (`Foo?` at line end) and `// MARK` lines, so the card landed in step 2.5.2 | Text explains `condition ? a : b`; it only mentions the line break after the question mark. Regex now matches real ternaries (also one-line). First use is now step 1.6.1. Title is "Conditional operator (? :)" |
| main-actor | Link fragment `The-main-actor` did not exist. Text said the compiler "checks that other code calls it with await" (unclear) | Link fragment `The-Main-Actor`. Text: other actors must use await |
| closure-isolation | Same broken link fragment | Fixed |
| get-async | Link fragment `Asynchronous-Properties` does not exist | Link to `concurrency#Defining-and-Calling-Asynchronous-Functions` |
| get-throws | Link pointed to typed throws (wrong topic) | Link to `errorhandling#Propagating-Errors-Using-Throwing-Functions` |
| target-environment | Last two sentences were confusing | Rewritten with the `!targetEnvironment(simulator)` meaning |
| actor | Regex missed `public actor`, `private actor` | Regex allows access modifiers |
| override-init | "gets the initializer" was wrong (it inherits it) | Rewritten |
| super-init | Marked common with 3 uses. Text incomplete | Not common. Text adds "after the subclass sets its own properties" |
| if-case | Common with 4 uses | Not common |
| typealias | Common with 3 uses | Not common |
| try-optional | Common with 5 uses in three distant chapters | Not common |
| task-generic | "A stored task can be cancelled later" was off topic | Text explains Success and Failure, and Never |
| required-coder | Unclear, common with 2 uses far apart | Clearer text (storyboard or nib). Not common |
| wrapper-storage | Unclear | Rewritten: assign the wrapper itself to `_name` |
| self-type | Mentioned enumerations; code uses `var id: Self { self }` | Text fits the code. Not common (2 uses) |
| condition-list | Common with 2 uses far apart | Not common |
| inout-argument | Regex could match `&&`. Text did not say it is a pointer for C | Regex excludes `&&`. Text adds the C pointer |
| task | Did not say that `Task.detached` does not inherit the actor (regex matches it) | Added |
| view-builder | Clumsy sentence | Rewritten |
| sendable | `@Sendable` closures (step 4.3.1) matched but were not explained | Added one sentence |
| key-path | First use is `@Environment(\.x)` and `.map(\.uniqueID)`; text named only KVO, onChange, sorting | Text names @Environment, observe, map |
| did-set | Regex also matches `willSet`; text did not mention it | Added willSet |
| main-attr | "its body is the scene" was inexact | App conformance, body returns scenes |
| escaping | "checks that the closure captures self explicitly" was unclear | Rewritten |
| if-let-shorthand | Did not mention guard | Added |
| existential-any | Wording "behind a box" unclear | Rewritten |
| sendable-metatype | Text was wrong (said generic type usable from any actor) | Now says the metatype is safe to pass between actors |
| inout | Wording | Simplified |

## Entries that are fine (39)

available, available-attr, conditional-compilation, nonisolated, implicitly-unwrapped, isolation, associatedtype, for-await, trailing-closures, private-set, discardable-result, forced-cast, shorthand-argument, nil-coalescing, result-type, metatype, assume-isolated, identity, tuple-comparison, async-let, continuation, async-stream, defer, guard, lazy, published, observable, state, binding, environment, some-view, preconcurrency, retroactive, weak-self, preview-macro, objc, rethrows, indirect, result-builder, typed-throws.

(typed-throws, result-builder, indirect, rethrows, async-let, lazy, objc, inout, available-attr and conditional-compilation are correct but match no step in the current tutorial. They stay as ready entries.)

## Link check

- All 69 pages return HTTP 200 (docs.swift.org pages, developer.apple.com JSON endpoints, GitHub proposals). No 404.
- Fragments of the Swift book links were checked against the heading anchors in the page data. Three were wrong (main-actor, closure-isolation, get-async) and are fixed. All other fragments exist.

## Placement

After the fix the cards land in these first steps (chapter.section.step), for example: ternary 1.6.1, actor 1.3.1, nonisolated 1.2.9, closure-isolation 1.2.9, target-environment 2.1.6, key-path 2.3.5, available 16.2.3, assume-isolated 16.3.5, tuple-comparison 17.2.6. All are sensible first uses.
