/**
 * Shared background upload service.
 *
 * Both normal (delivery) and field-test modes dispatch uploads through this
 * module. Provides a single point to add retry logic, offline queuing, or
 * analytics in the future.
 */

type UploadFn = () => Promise<unknown>;

/**
 * Fire-and-forget background upload dispatcher.
 *
 * @param tag  - Identifier for the upload type (e.g. 'delivery', 'field-test')
 * @param fn   - Async function that performs the actual upload work
 */
export function dispatchBackgroundUpload(tag: string, fn: UploadFn): void {
    fn()
        .then(() => console.log(`[Upload:${tag}] ✅ Success`))
        .catch((e) => console.warn(`[Upload:${tag}] ❌ Failed:`, e));
}
