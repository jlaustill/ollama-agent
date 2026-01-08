/**
 * TResult - Discriminated union for explicit error handling
 *
 * Use this instead of throwing errors for expected failures.
 * Forces callers to handle both success and error cases explicitly.
 *
 * @example
 * ```typescript
 * function readFile(path: string): TResult<string, FileError> {
 *   try {
 *     const content = fs.readFileSync(path, 'utf-8');
 *     return { success: true, value: content };
 *   } catch (error) {
 *     return { success: false, error: new FileError('Cannot read file') };
 *   }
 * }
 *
 * // Caller must handle both cases
 * const result = readFile('test.txt');
 * if (result.success) {
 *   console.log(result.value); // TypeScript knows this exists
 * } else {
 *   console.error(result.error); // TypeScript knows this exists
 * }
 * ```
 */
type TResult<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

export default TResult;
