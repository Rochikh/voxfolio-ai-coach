/**
 * URL publique canonique de l'application, utilisée pour encoder les QR codes.
 *
 * On privilégie le domaine de production (VITE_PUBLIC_APP_URL) : sans cela, un QR
 * généré depuis localhost ou une preview Vercel encode ce domaine non public, et
 * le téléphone qui le scanne obtient « page inaccessible ». Repli sur l'origine
 * courante quand la variable n'est pas définie (ex. dev local).
 */
export function getPublicAppUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL as string | undefined;
  const base = configured?.trim() || window.location.origin;
  return base.replace(/\/+$/, "");
}
