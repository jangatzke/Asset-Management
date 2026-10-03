// fix-locales.js - Generate complete locale files with new keys
const fs = require('fs');

const deLocale = {
  "common": {
    "save": "Speichern",
    "cancel": "Abbrechen",
    "delete": "Löschen",
    "edit": "Bearbeiten",
    "create": "Erstellen",
    "search": "Suchen",
    "loading": "Wird geladen...",
    "saving": "Wird gespeichert...",
    "noResults": "Keine Ergebnisse gefunden",
    "actions": "Aktionen",
    "close": "Schließen",
    "confirm": "Bestätigen",
    "confirmDelete": "Sind Sie sicher, dass Sie dieses Element löschen möchten?",
    "yes": "Ja",
    "no": "Nein",
    "ok": "OK",
    "required": "Erforderlich",
    "requiredField": "Dieses Feld ist erforderlich",
    "saveSuccess": "Erfolgreich gespeichert",
    "saved": "Erfolgreich gespeichert",
    "deleteSuccess": "Erfolgreich gelöscht",
    "deleteConfirm": "Sind Sie sicher, dass Sie dieses Element löschen möchten?",
    "saveError": "Speichern fehlgeschlagen",
    "deleteError": "Löschen fehlgeschlagen",
    "name": "Name",
    "description": "Beschreibung",
    "status": "Status",
    "type": "Typ",
    "created": "Erstellt",
    "updated": "Aktualisiert",
    "select": "Auswählen",
    "createNew": "Neu erstellen",
    "role": "Rolle",
    "group": "Gruppe",
    "users": "Benutzer",
    "roles": "Rollen"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "assets": "Vermögenswerte",
    "risks": "Risiken",
    "controls": "Kontrollen",
    "incidents": "Vorfälle",
    "admin": "Admin",
    "userManagement": "Benutzerverwaltung",
    "roleManagement": "Rollenv"
  }
};

fs.writeFileSync('frontend/src/locales/de.json', JSON.stringify(deLocale, null, 2));
console.log('de.json written');