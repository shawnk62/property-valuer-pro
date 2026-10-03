/** Ask before a permanent delete. Returns false if the user cancels. */
export function confirmDelete(what: string): boolean {
  return window.confirm(
    `Delete ${what}?\n\nThis cannot be undone.`,
  );
}
