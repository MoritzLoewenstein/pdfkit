import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup, EditorView } from 'codemirror';
import { PDFDocument, toBlob } from '../../lib/document.js';
import { loadFonts } from '../quickstart/browser_fonts.js';
import { lorem } from '../quickstart/simple_pdf.js';
import { example } from './example.js';
import './style.css';

const STORAGE_KEY = 'editorText';
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const preview = document.querySelector('#preview');
const errorPanel = document.querySelector('#error-panel');
const errorTitle = document.querySelector('#error-title');
const errorMessage = document.querySelector('#error-message');
const errorDetails = document.querySelector('#error-details');
const errorStack = document.querySelector('#error-stack');

let generation = 0;
let debounceTimer;
let previewUrl;
let fonts;

async function generatePdf(source, revision) {
  try {
    const execute = new AsyncFunction(
      'PDFDocument',
      'toBlob',
      'lorem',
      'fontData',
      'fontItalicData',
      source,
    );
    fonts ??= loadFonts().catch((error) => {
      fonts = undefined;
      throw error;
    });
    const [fontData, fontItalicData] = await fonts;
    if (revision !== generation) return;

    const blob = await execute(
      PDFDocument,
      toBlob,
      lorem,
      fontData,
      fontItalicData,
    );
    if (revision !== generation) return;
    if (!(blob instanceof Blob) || blob.type !== 'application/pdf') {
      throw new TypeError('The editor code must return a PDF Blob.');
    }

    const previousUrl = previewUrl;
    previewUrl = URL.createObjectURL(blob);
    preview.src = previewUrl;
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    errorPanel.hidden = true;
  } catch (error) {
    if (revision !== generation) return;
    errorTitle.textContent = error?.name ?? 'Error';
    errorMessage.textContent = error?.message ?? String(error);
    errorStack.textContent = error?.stack ?? '';
    errorDetails.hidden = !errorStack.textContent;
    errorDetails.open = false;
    errorPanel.hidden = false;
  }
}

let source = example;
try {
  source = localStorage.getItem(STORAGE_KEY) ?? source;
} catch {
  // The editor still works when storage is disabled.
}

new EditorView({
  parent: document.querySelector('#editor'),
  doc: source,
  extensions: [
    basicSetup,
    javascript(),
    oneDark,
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': 'PDFKit JavaScript' }),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      const edited = update.state.doc.toString();
      try {
        localStorage.setItem(STORAGE_KEY, edited);
      } catch {
        // Keep rendering, even if persistence is unavailable.
      }
      const revision = ++generation;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => generatePdf(edited, revision), 300);
    }),
  ],
});

generatePdf(source, generation);
