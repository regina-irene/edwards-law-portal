// components/admin/client-action-style.ts — one definition of the row actions
// on the admin Clients list, shared by the page and by the two action
// components that live in their own files.
//
// Previously each of the three copied the same stacked "icon above label,
// fixed 4.5rem wide" string. Seven of those overflowed the row's max width, so
// flex-wrap dropped the actions onto a second line — but only for the clients
// that happened to have every action, which is why some rows looked different
// from others. These are laid out horizontally instead: about half the height,
// a third of the width, and they stay on the client's line. (2026-08-18)

/** The tappable action itself. Same on a link, a button, or a form submit. */
export const CLIENT_ACTION_CLS =
  "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-100 " +
  "transition-colors whitespace-nowrap disabled:opacity-70"

/** The emoji. Deliberately close to the label size — these are labels, not art. */
export const CLIENT_ACTION_ICON_CLS = "text-base leading-none"

/** The word under… beside the icon. */
export const CLIENT_ACTION_LABEL_CLS = "text-[11px] font-medium text-gray-600"
