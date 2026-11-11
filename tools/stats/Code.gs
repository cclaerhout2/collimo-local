/**
 * Relais de statistiques Collimo (Google Apps Script).
 *
 * Déployé une fois par un admin de Collimo, en application web « Exécuter en tant que : moi ».
 * Collimo lui envoie, après chaque collage enregistré, quelques compteurs (jamais de photo) avec le
 * jeton Google de l'utilisateur. Le relais vérifie ce jeton (émis pour Collimo, compte du domaine),
 * remplace l'adresse par un pseudonyme, et ajoute une ligne dans la Google Sheet
 * « Collimo – Statistiques », créée dans le Drive de l'admin au premier appel.
 * Les lignes de plus de 13 mois sont supprimées automatiquement.
 *
 * Ce fichier est un modèle : Collimo affiche le code avec les valeurs ci-dessous déjà remplies.
 */

/** ID client OAuth de Collimo : seuls les jetons émis pour lui sont acceptés. */
var COLLIMO_CLIENT_ID = '__CLIENT_ID__';
/** Domaines autorisés (vide = tous les comptes). */
var COLLIMO_DOMAINS = __DOMAINS__;
/** Version du relais, vérifiée par Collimo. */
var RELAY_VERSION = __VERSION__;
/** Nom de la Google Sheet créée au premier appel. */
var SHEET_NAME = 'Collimo – Statistiques';
/** Colonnes de la feuille, dans l'ordre. */
var COLUMNS = [
  'date', 'utilisateur', 'evenement', 'appareil', 'photos', 'disposition', 'source_disposition',
  'format', 'taille', 'ratio', 'zones_masquees', 'textes', 'stickers', 'filtre', 'serie', 'duree_ms', 'erreur',
];
/** Durée de conservation des lignes, en mois. */
var RETENTION_MONTHS = 13;

/**
 * Vérification de santé, sans authentification et sans donnée.
 * @return {GoogleAppsScript.Content.TextOutput} la version du relais
 */
function doGet() {
  return json_({ ok: true, app: 'collimo-stats', version: RELAY_VERSION });
}

/**
 * Point d'entrée de Collimo : `{ action: 'ping' | 'event', token, event? }`.
 * @param {GoogleAppsScript.Events.DoPost} e - requête
 * @return {GoogleAppsScript.Content.TextOutput} `{ ok, ... }` en JSON
 */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var who = verify_(body.token);
    if (body.action === 'ping') {
      var ss = spreadsheet_();
      return json_({ ok: true, app: 'collimo-stats', version: RELAY_VERSION, sheetId: ss.getId(), sheetUrl: ss.getUrl() });
    }
    if (body.action === 'event') {
      record_(who, body.event || {});
      return json_({ ok: true });
    }
    return json_({ ok: false, error: 'unknown-action' });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

/**
 * Vérifie le jeton : émis pour Collimo, valide, compte d'un domaine autorisé. Résultat gardé
 * 5 minutes en cache pour limiter les appels à Google.
 * @param {string} token - jeton d'accès de l'utilisateur
 * @return {string} le pseudonyme de l'utilisateur
 */
function verify_(token) {
  if (!token || typeof token !== 'string') throw new Error('token-missing');
  var cache = CacheService.getScriptCache();
  var key = 'tk' + digest_(token).slice(0, 40);
  var hit = cache.get(key);
  if (hit) return hit;
  var info = fetchJson_('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), null);
  if (!info || (info.azp !== COLLIMO_CLIENT_ID && info.aud !== COLLIMO_CLIENT_ID)) throw new Error('token-refused');
  if (Number(info.expires_in) <= 0) throw new Error('token-expired');
  var about = fetchJson_('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', token);
  var email = String((about && about.user && about.user.emailAddress) || '').toLowerCase();
  if (!email) throw new Error('token-refused');
  if (COLLIMO_DOMAINS.length && COLLIMO_DOMAINS.indexOf(email.split('@')[1]) < 0) throw new Error('domain-refused');
  var pseudo = pseudonym_(email);
  cache.put(key, pseudo, 300);
  return pseudo;
}

/**
 * Pseudonyme stable d'une adresse : HMAC-SHA256 avec un sel secret propre à ce relais.
 * @param {string} email - adresse en minuscules
 * @return {string} 12 caractères
 */
function pseudonym_(email) {
  var props = PropertiesService.getScriptProperties();
  var salt = props.getProperty('salt');
  if (!salt) {
    salt = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('salt', salt);
  }
  var sig = Utilities.computeHmacSha256Signature(email, salt);
  return Utilities.base64EncodeWebSafe(sig).replace(/=+$/, '').slice(0, 12);
}

/**
 * Empreinte SHA-256 d'un texte, en base 64.
 * @param {string} text - texte
 * @return {string} l'empreinte
 */
function digest_(text) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text));
}

/**
 * Appel GET qui renvoie du JSON, ou `null` en cas de refus.
 * @param {string} url - adresse
 * @param {string|null} token - jeton à joindre, s'il y en a un
 * @return {Object|null} la réponse
 */
function fetchJson_(url, token) {
  var options = { muteHttpExceptions: true };
  if (token) options.headers = { Authorization: 'Bearer ' + token };
  var res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() !== 200) return null;
  return JSON.parse(res.getContentText());
}

/**
 * Sheet des statistiques : retrouvée par son identifiant, ou créée avec ses en-têtes.
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet} la Sheet
 */
function spreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('sheetId');
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      // Supprimée ou plus accessible : on en recrée une.
    }
  }
  var ss = SpreadsheetApp.create(SHEET_NAME);
  var sheet = ss.getSheets()[0];
  sheet.setName('Événements');
  sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  props.setProperty('sheetId', ss.getId());
  return ss;
}

/**
 * Ajoute une ligne d'événement, après nettoyage des valeurs ; purge une fois par jour.
 * @param {string} who - pseudonyme
 * @param {Object} ev - compteurs envoyés par Collimo
 */
function record_(who, ev) {
  var row = [
    new Date().toISOString(),
    who,
    text_(ev.event),
    text_(ev.device),
    num_(ev.photos),
    text_(ev.layout),
    text_(ev.layoutSource),
    text_(ev.format),
    text_(ev.size),
    text_(ev.ratio),
    num_(ev.masks),
    num_(ev.texts),
    num_(ev.stickers),
    text_(ev.filter),
    num_(ev.series),
    num_(ev.durationMs),
    text_(ev.error),
  ];
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = spreadsheet_();
    ss.getSheets()[0].appendRow(row);
    purge_(ss);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Supprime, une fois par jour, les lignes de plus de RETENTION_MONTHS mois (les plus anciennes sont en haut).
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss - Sheet
 */
function purge_(ss) {
  var props = PropertiesService.getScriptProperties();
  var today = new Date().toISOString().slice(0, 10);
  if (props.getProperty('lastPurge') === today) return;
  props.setProperty('lastPurge', today);
  var sheet = ss.getSheets()[0];
  var last = sheet.getLastRow();
  if (last < 2) return;
  var cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  var dates = sheet.getRange(2, 1, last - 1, 1).getValues();
  var n = 0;
  while (n < dates.length && new Date(dates[n][0]) < cutoff) n++;
  if (n > 0) sheet.deleteRows(2, n);
}

/**
 * Texte court et sans formule (une valeur commençant par = + - @ serait interprétée par Sheets).
 * @param {*} v - valeur reçue
 * @return {string} le texte nettoyé
 */
function text_(v) {
  var s = typeof v === 'string' ? v.slice(0, 64) : '';
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/**
 * Nombre entier borné, ou vide.
 * @param {*} v - valeur reçue
 * @return {number|string} le nombre, ou une chaîne vide
 */
function num_(v) {
  var n = Number(v);
  return isFinite(n) && n >= 0 ? Math.min(Math.round(n), 1e9) : '';
}

/**
 * Réponse JSON.
 * @param {Object} o - contenu
 * @return {GoogleAppsScript.Content.TextOutput} la réponse
 */
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
