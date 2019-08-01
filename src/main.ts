import * as vscode from 'vscode'
import * as path from 'path'

import { Logger } from './components/logger'
import { CompletionWatcher, Completer } from './components/completionWatcher'
import { Paster } from './components/paster'
import { WordCounter } from './components/wordCounter'
import { TikzCodeLense } from './providers/tikzcodelense'
import { TikzPictureView } from './components/tikzpreview'
import * as utils from './utils'

export function activate(context: vscode.ExtensionContext) {
    const extension = new Extension()

    if (extension.workshop === undefined) {
        throw new Error('LaTeX Workshop required, not found')
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('latex-utilities.editLiveSnippetsFile', () =>
            extension.completionWatcher.editSnippetsFile()
        ),
        vscode.commands.registerCommand('latex-utilities.formattedPaste', () => extension.paster.paste()),
        vscode.commands.registerCommand('latex-utilities.countWord', () => extension.wordCounter.count()),
        vscode.commands.registerCommand('latex-workshop.viewtikzpicture', (document, range) =>
            extension.tikzPreview.view(document, range)
        )
    )

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(
            (e: vscode.TextDocumentChangeEvent) => {
                if (utils.hasTexId(e.document.languageId)) {
                    extension.completionWatcher.watcher(e)
                    extension.tikzPreview.onFileChange(e.document, e.contentChanges)
                }
            },
            undefined,
            [new vscode.Disposable(extension.tikzPreview.cleanupTempFiles)]
        ),
        vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => {
            if (e.uri.fsPath === extension.completionWatcher.snippetFile.user) {
                extension.completionWatcher.loadSnippets(true)
            }
        })
    )

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'tex' }, extension.completer),
        vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'latex' }, extension.completer),
        vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'doctex' }, extension.completer),
        vscode.languages.registerCodeLensProvider({ language: 'latex', scheme: 'file' }, new TikzCodeLense())
    )
}

export function deactivate() {}

export class Extension {
    extensionRoot: string
    workshop: vscode.Extension<LaTeXWorkshopAPI>
    logger: Logger
    completionWatcher: CompletionWatcher
    completer: Completer
    paster: Paster
    wordCounter: WordCounter
    tikzPreview: TikzPictureView

    constructor() {
        this.extensionRoot = path.resolve(`${__dirname}/../../`)
        // @ts-ignore
        this.workshop = vscode.extensions.getExtension('james-yu.latex-workshop')
        if (this.workshop !== undefined && this.workshop.isActive === false) {
            this.workshop.activate()
        }
        this.logger = new Logger(this)
        this.completionWatcher = new CompletionWatcher(this)
        this.completer = new Completer(this)
        this.paster = new Paster(this)
        this.wordCounter = new WordCounter(this)
        this.tikzPreview = new TikzPictureView(this)
    }
}

interface LaTeXWorkshopAPI {
    getRootFile: () => string
    getGraphicsPath: () => string[]
    setEnvVar: () => void
    viewer: {
        clients: {
            [key: string]: {
                viewer: 'browser' | 'tab'
                websocket: unknown
                position?: {}
            }[]
        }
        refreshExistingViewer(sourceFile?: string, viewer?: string): boolean
        openTab(sourceFile: string, respectOutDir: boolean, sideColumn: boolean): void
    }
    manager: {
        findRoot: () => Promise<string | undefined>
        rootDir: () => string
        rootFile: () => string
    }
}
