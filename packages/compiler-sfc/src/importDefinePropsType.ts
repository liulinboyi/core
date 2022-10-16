import fs from 'fs'
import path from 'path'
import { ParserOptions, ParserPlugin } from '@babel/parser'
import {
  ImportDeclaration,
  StringLiteral,
  Statement,
  Program,
  Node
} from '@babel/types'

// https://stackoverflow.com/a/31090240
const isNode = new Function(
  'try {return this===global;}catch(e){return false;}'
)

interface ImportDeclarationInfo extends ImportDeclaration {
  source: StringLiteral & { curPath?: string; plugins?: ParserPlugin[] }
}

export function setDefinePropsInfo(
  filename: string,
  plugins: ParserPlugin[],
  node: ImportDeclarationInfo
) {
  if (isNode()) {
    let curPath = path.dirname(filename)
    node.source.curPath = curPath
    node.source.plugins = plugins
  }
}

function fileExists(path: string) {
  return fs.existsSync(path)
}

function getFileContent(path: string) {
  return fs.readFileSync(path).toString()
}

export function getFileDefinePropsType(
  body: Statement[],
  parse: (input: string, options: ParserOptions, offset: number) => Program,
  isQualifiedType: (node: Node) => Node | undefined,
  error: (msg: string, node: Node, end?: number) => never
) {
  if (isNode()) {
    for (const node of body) {
      try {
        let rpath = path.resolve(
          (node as ImportDeclarationInfo).source.curPath!,
          (node as ImportDeclarationInfo).source.value
        )
        let content
        if (fileExists(`${rpath}.ts`)) {
          content = getFileContent(`${rpath}.ts`)
        } else if (fileExists(`${rpath}.d.ts`)) {
          content = getFileContent(`${rpath}.d.ts`)
        } else {
          throw new Error('The import file is not exit.')
        }
        const result = parse(
          content,
          {
            plugins: [
              ...((node as ImportDeclarationInfo).source.plugins ?? [])
            ],
            sourceType: 'module'
          },
          0
        )
        for (const importNode of result.body.filter(
          n => n.type === 'ExportNamedDeclaration' && n.exportKind === 'type'
        )) {
          const qualified = isQualifiedType(importNode)
          if (qualified) {
            return qualified
          }
        }
      } catch (err) {
        error(`get import Prop fail.`, node)
      }
    }
  }
}
