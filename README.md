# ミラノア受付システム

iPad 受付用の静的 Web アプリです。訪問者が部署名と名前を音声または手入力すると、該当する内線番号を表示します。

## 画面構成

- `index.html`: 受付本体。iPad で常時表示する画面です。
- `admin.html`: 管理画面。TXT / CSV / TSV を読み込み、公開用の `data/directory.js` を生成します。
- `data/directory.js`: 公開中の内線データです。

## 公開 URL

GitHub Pages を有効化すると、公開 URL は次の形になります。

- `https://noborunakatani.github.io/miranoa-reception-system/`

## GitHub Pages の有効化

1. GitHub リポジトリの `Settings` を開く
2. `Pages` を開く
3. Source を `GitHub Actions` にする
4. `main` 更新後に Pages デプロイが走ることを確認する

この repo には `.github/workflows/pages.yml` を含めています。Pages を有効化すると、以後は `main` の更新で再公開されます。

## 受付画面の使い方

1. `index.html` を iPad で開く
2. `音声で検索を開始` を押して部署名と名前を話す
3. 音声認識に失敗した場合は、手入力欄か iPad キーボードの音声入力を使う
4. 候補が複数ある場合は候補一覧から選ぶ

## 内線表の更新方法

1. `admin.html` を開く
2. 内線表ファイルをアップロードするか、内容を貼り付ける
3. 生成された `directory.js` をダウンロードする
4. repo の `data/directory.js` をその内容で置き換える
5. `main` に反映する

## 想定する入力形式

以下の 3 列を含むテキストを想定しています。

```text
部署名,名前,内線番号
総務部,中谷 昇,1001
営業部,佐藤 美咲,2101
```

- 区切り文字は `,` `タブ` `、` `2個以上の空白` を想定
- 先頭行に `部署名` `名前` `内線番号` の見出しがある形式に対応

## 補足

- ブラウザが Web Speech API を提供しない場合、受付画面の音声ボタンは無効になります。
- その場合でも、iPad キーボードの音声入力または手入力で運用できます。
