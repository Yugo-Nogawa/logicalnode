import tkinter as tk
from tkinter import ttk, messagebox, filedialog, colorchooser, simpledialog
from tkinter import font as tkfont
import uuid
import json
import os
import sys
import base64

class MindMapApp:
    def __init__(self, root, file_path=None):
        self.root = root
        self.root.title("Logical Node 2")
        self.root.geometry("1200x800")

        # データの初期化
        self.nodes = {}
        root_id = self.generate_new_id()
        self.nodes[root_id] = {
            'id': root_id,
            'name': 'ルートノード',
            'parent_id': None,
            'color': 'black',
            'children': [],
            'expanded': True
        }
        # ルートノードをリストで管理
        self.root_nodes = [root_id]

        # 現在のファイルパス（上書き保存用）
        self.current_file_path = None

        # 未保存の変更があるかどうかを示すフラグ
        self.is_modified = False

        # アクションスタックの初期化（Undo、Redo用）
        self.undo_stack = []
        self.redo_stack = []
        
        # アイコンの参照を保持するディクショナリ
        self.node_icons = {}

        # コピー・ペースト用のバッファ
        self.clipboard = None
        
        # フォントの設定
        preferred_fonts = ["ヒラギノUD角ゴ StdN W4","游ゴシック Medium", "Yu Gothic Medium", "Meiryo", "MS PGothic",  "Noto Sans JP", "Arial"]
        best_font = self.find_best_font(preferred_fonts)
        self.default_font = tkfont.Font(family=best_font, size=9)
        self.bold_font = tkfont.Font(family=best_font, size=9, weight="bold")

        # ノード描画用変数
        self.node_positions = {}
        self.node_widgets = {}
        self.node_order = []
        self.node_lines = {}  # 親子を結ぶ線を保存
        
        # ドラッグアンドドロップ関連の属性を追加
        self.dragging_node = None
        self.drag_started = False
        self.drag_offset_x = 0
        self.drag_offset_y = 0
        self.drag_start_x = 0
        self.drag_start_y = 0   

        # ドラッグアンドドロップ時の一時的なアイテム
        self.dragged_item = None

        # ドラッグアンドドロップ時のハイライト
        self.drop_highlight = None
        self.insert_line = None

        # 選択中のノードID
        self.selected_node_id = root_id
        self.last_selected_node_id = root_id  # 最後に選択されたノードID
        
        self.is_editing = False  # テキスト編集中かどうかを示すフラグ

        # キャンバスの作成（スクロール対応）
        self.canvas_frame = tk.Frame(root)
        self.canvas_frame.pack(fill=tk.BOTH, expand=True)

        # メニューバーの作成
        self.create_menu()

        # 操作ボタンの作成
        self.create_toolbar()

        self.canvas = tk.Canvas(self.canvas_frame, bg='white')
        self.canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # スクロールバーの作成
        self.v_scroll = tk.Scrollbar(self.canvas_frame, orient=tk.VERTICAL, command=self.canvas.yview)
        self.v_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.h_scroll = tk.Scrollbar(root, orient=tk.HORIZONTAL, command=self.canvas.xview)
        self.h_scroll.pack(side=tk.BOTTOM, fill=tk.X)

        self.canvas.configure(yscrollcommand=self.v_scroll.set, xscrollcommand=self.h_scroll.set)
        self.canvas.bind('<Configure>', self.on_canvas_configure)

        # ツリーの構築
        self.populate_tree()

        # ショートカットキーのバインド
        self.bind_shortcuts()

        # ウィンドウの閉じるイベントにバインド
        self.root.protocol("WM_DELETE_WINDOW", self.close_window)
        
        # 展開/折りたたみアイコンの文字を設定
        self.expanded_icon = "▼"
        self.collapsed_icon = "▶"
        
        # アイコンの参照を保持するディクショナリ
        self.node_icons = {}

        # print("現在のデフォルトフォント:", self.default_font.actual()['family'])
        # print("現在の太字フォント:", self.bold_font.actual()['family'])
        
        # ファイルパスが指定されている場合、そのファイルを読み込む
        if file_path:
            self.load_file(file_path)

    def create_triangle_icon(self, direction):
        canvas = tk.Canvas(width=16, height=16, bg="white", highlightthickness=0)
        if direction == "down":
            canvas.create_polygon(8, 12, 3, 5, 13, 5, fill="black")
        else:  # right
            canvas.create_polygon(12, 8, 5, 3, 5, 13, fill="black")
        return canvas
    
    def create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)

        # ファイルメニュー
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="ファイル", menu=file_menu)
        file_menu.add_command(label="開く", accelerator="Ctrl+O", command=self.load_data)
        file_menu.add_command(label="上書き保存", accelerator="Ctrl+S", command=self.save_data)
        file_menu.add_command(label="名前を付けて保存", accelerator="Ctrl+Shift+S", command=self.save_data_as)
        file_menu.add_separator()
        file_menu.add_command(label="新規ウィンドウ", accelerator="Ctrl+N", command=self.new_window)
        file_menu.add_command(label="ウィンドウを閉じる", accelerator="Ctrl+W", command=self.close_window)
        file_menu.add_separator()
        file_menu.add_command(label="終了", accelerator="Alt+F4", command=self.quit_application)

        # 編集メニュー
        edit_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="編集", menu=edit_menu)
        edit_menu.add_command(label="ノード追加", command=self.add_node)
        edit_menu.add_command(label="兄弟ノード追加", command=self.add_sibling_node)
        edit_menu.add_command(label="ノード削除", command=self.delete_node)
        edit_menu.add_command(label="テキストの色を変更", command=self.change_text_color)
        edit_menu.add_separator()
        edit_menu.add_command(label="コピー", accelerator="Ctrl+C", command=self.copy_node)
        edit_menu.add_command(label="ペースト", accelerator="Ctrl+V", command=self.paste_node)
        edit_menu.add_command(label="プレーンテキストとしてコピー", accelerator="Ctrl+Shift+C", command=self.copy_as_plain_text)
        edit_menu.add_separator()
        edit_menu.add_command(label="元に戻す", accelerator="Ctrl+Z", command=self.undo_action)
        edit_menu.add_command(label="やり直し", accelerator="Ctrl+Y / Ctrl+Shift+Z", command=self.redo_action)
        
        # 表示メニュー
        view_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="表示", menu=view_menu)
        view_menu.add_command(label="フォント変更", command=self.show_font_selection)

    def show_font_selection(self):
        available_fonts = self.get_available_fonts()
        font_window = tk.Toplevel(self.root)
        font_window.title("フォント選択")
        font_listbox = tk.Listbox(font_window, width=50)
        font_listbox.pack(padx=10, pady=10)
        for font in available_fonts:
            font_listbox.insert(tk.END, font)
        
        def on_select():
            selection = font_listbox.curselection()
            if selection:
                font = font_listbox.get(selection[0])
                self.default_font.configure(family=font)
                self.bold_font.configure(family=font)
                self.populate_tree()
                font_window.destroy()
        
        select_button = tk.Button(font_window, text="選択", command=on_select)
        select_button.pack(pady=10)

    def create_toolbar(self):
        toolbar = tk.Frame(self.root)
        toolbar.pack(side=tk.TOP, fill=tk.X)

        add_node_btn = tk.Button(toolbar, text="ノード追加", command=self.add_node)
        add_node_btn.pack(side=tk.LEFT, padx=2, pady=2)

        add_sibling_btn = tk.Button(toolbar, text="兄弟ノード追加", command=self.add_sibling_node)
        add_sibling_btn.pack(side=tk.LEFT, padx=2, pady=2)

        delete_node_btn = tk.Button(toolbar, text="ノード削除", command=self.delete_node)
        delete_node_btn.pack(side=tk.LEFT, padx=2, pady=2)

        change_color_btn = tk.Button(toolbar, text="テキストの色を変更", command=self.change_text_color)
        change_color_btn.pack(side=tk.LEFT, padx=2, pady=2)
        
        bold_btn = tk.Button(toolbar, text="太字", command=self.toggle_bold)
        bold_btn.pack(side=tk.LEFT, padx=2, pady=2)

    def bind_shortcuts(self):
        # ショートカットキーのバインド
        self.root.bind('<Control-s>', self.save_data_shortcut)
        self.root.bind('<Control-S>', self.save_data_as_shortcut)
        self.root.bind('<Control-o>', self.load_data_shortcut)
        self.root.bind('<Control-w>', self.close_window_shortcut)
        self.root.bind('<Control-W>', self.close_window_shortcut)
        self.root.bind('<Control-z>', self.undo_action)
        self.root.bind('<Control-Shift-z>', self.redo_action)
        self.root.bind('<Control-Z>', self.redo_action)
        self.root.bind('<Control-y>', self.redo_action)
        self.root.bind('<Delete>', self.delete_node)
        self.root.bind('<Escape>', self.escape_key_action)
        self.root.bind('<Control-c>', self.copy_node_shortcut)
        self.root.bind('<Control-v>', self.paste_node_shortcut)
        self.root.bind('<Control-C>', self.copy_node_shortcut)
        self.root.bind('<Control-V>', self.paste_node_shortcut)
        self.root.bind('<Control-Shift-c>', self.copy_as_plain_text_shortcut)
        self.root.bind('<Control-C>', self.copy_as_plain_text_shortcut)

        # ノード追加（子ノード）：TabキーまたはCtrl+K
        self.root.bind('<Tab>', self.add_node_shortcut)
        self.root.bind('<Control-k>', self.add_node_shortcut)

        # 兄弟ノード追加：Ctrl+Enter
        self.root.bind('<Control-Return>', self.add_sibling_node_shortcut)
        self.root.bind('<Control-KP_Enter>', self.add_sibling_node_shortcut)  # テンキーのEnterキー対応

        # ノード編集：Enterキー
        self.root.bind('<Return>', self.edit_node_shortcut)

        # 矢印キーでノード選択を移動
        self.root.bind('<Up>', self.select_node_up)
        self.root.bind('<Down>', self.select_node_down)
        self.root.bind('<Left>', self.select_node_left)
        self.root.bind('<Right>', self.select_node_right)

        # 兄弟ノードの並び替え
        self.root.bind('<Control-Up>', self.move_node_up)
        self.root.bind('<Control-Down>', self.move_node_down)

        # Ctrl+Left/Rightでノードを移動
        self.root.bind('<Control-Left>', self.move_node_left)
        self.root.bind('<Control-Right>', self.move_node_right)
        
        # 太字のショートカットを追加
        self.root.bind('<Control-b>', self.toggle_bold_shortcut)

        # 新しいショートカット
        self.root.bind('<Control-n>', self.new_window_shortcut)
        self.root.bind('<Control-a>', self.select_all)

    def generate_new_id(self):
        return str(uuid.uuid4())

    def populate_tree(self):
        # ツリーを再描画する前にアイコンの参照をクリア
        self.node_icons.clear()
        
        self.canvas.delete("all")  # 既存の描画をクリア
        self.node_positions.clear()  # ノードの位置をクリア
        self.node_widgets.clear()
        self.node_lines.clear()
        self.node_order = []  # ノードの描画順序を記録

        # ノードを描画
        self.draw_tree()

        # キャンバスのスクロールリージョンを更新
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))

        # 選択状態を更新
        self.update_node_styles()
        
    def draw_tree(self):
        # ノードの矩形サイズ
        width = 150
        padding = 0  # テキストの上下パディング

        # フォントオブジェクトを作成
        font = self.default_font

        # キャンバスをクリア
        self.canvas.delete("all")

        # ノードの位置を計算
        positions = {}
        y_offset = 50
        for root_id in self.root_nodes:
            tree_height = self.calculate_positions(root_id, 0, 100, y_offset, positions, font, padding)
            y_offset += tree_height + 50  # ルートノード間に固定の垂直間隔を追加

        # ノードを描画
        for node_id, (x, y, height) in positions.items():
            if self.should_draw_node(node_id):
                self.draw_node(node_id, x, y, height)
                
        # 親子を結ぶ線を描画
        for node_id, (x, y, height) in positions.items():
            node = self.nodes[node_id]
            parent_id = node['parent_id']
            if parent_id and parent_id in positions:
                parent_x, parent_y, parent_height = positions[parent_id]
                
                # 横線の中点を計算
                mid_x = (parent_x + width / 2 + x - width / 2) / 2
                
                # 親ノードからの横線を描画（ノードの縦中央から）
                self.canvas.create_line(parent_x + width / 2, parent_y, mid_x, parent_y, fill='#666', dash=(1, 1))
                
                # 縦線を描画
                self.canvas.create_line(mid_x, parent_y, mid_x, y, fill='#666', dash=(1, 1))
                
                # 子ノードへの横線を描画（ノードの縦中央まで）
                self.canvas.create_line(mid_x, y, x - width / 2, y, fill='#666', dash=(1, 1))


        self.node_positions = positions

        # キャンバスのスクロール領域を更新
        self.canvas.config(scrollregion=self.canvas.bbox("all"))

        # ノードの順序を保存
        self.node_order = list(positions.keys())
        
    def should_draw_node(self, node_id):
        node = self.nodes[node_id]
        parent_id = node['parent_id']
        while parent_id:
            if not self.nodes[parent_id].get('expanded', True):
                return False
            parent_id = self.nodes[parent_id]['parent_id']
        return True
    
    def calculate_positions(self, node_id, depth, x, y, positions, font, padding):
        node = self.nodes[node_id]
        min_height = 30  # 最小ノード高さ

        # ノードの実際の高さを計算
        temp_text = self.canvas.create_text(0, 0, text=node['name'], width=140, font=font)
        text_bbox = self.canvas.bbox(temp_text)
        self.canvas.delete(temp_text)
        text_height = text_bbox[3] - text_bbox[1]
        node_height = max(text_height + 2 * padding, min_height)

        positions[node_id] = (x, y, node_height)

        if not node['children'] or not node.get('expanded', True):
            return node_height

        # 子ノードの位置を計算
        child_x = x + 200  # 固定の水平間隔
        child_y = y
        total_height = 0
        for child_id in node['children']:
            if self.should_draw_node(child_id):
                child_height = self.calculate_positions(child_id, depth + 1, child_x, child_y, positions, font, padding)
                child_y += child_height + 5  # 子ノード間の垂直間隔を5に設定
                total_height += child_height + 5

        # 親ノードの高さは変更せず、子ノードの合計高さを返す
        return max(node_height, total_height - 5)  # 最後の間隔を引く

    def get_subtree_height(self, node_id, font, padding):
        node = self.nodes[node_id]
        temp_text = self.canvas.create_text(0, 0, text=node['name'], font=font)
        text_bbox = self.canvas.bbox(temp_text)
        self.canvas.delete(temp_text)  # 一時的なテキストオブジェクトを削除
        text_height = text_bbox[3] - text_bbox[1]
        node_height = text_height + 2 * padding
        if not node['children']:
            return node_height
        else:
            return node_height + sum([self.get_subtree_height(child_id, font, padding) for child_id in node['children']])

    def draw_node(self, node_id, x, y, height):
        node = self.nodes[node_id]
        width = 150
        padding = 0

        # ノードの矩形を描画
        rect = self.canvas.create_rectangle(
            x - width / 2,
            y - height / 2,
            x + width / 2,
            y + height / 2,
            fill='',
            outline=''
        )

        # 選択状態の場合、背景色を変更
        if self.selected_node_id == node_id:
            self.canvas.itemconfig(rect, fill='lightblue')

        # 展開/折りたたみアイコンを描画
        if node['children']:
            icon_x = x - width / 2 - 20
            icon_y = y
            icon = self.expanded_icon if node.get('expanded', True) else self.collapsed_icon
            toggle = self.canvas.create_text(icon_x, icon_y, text=icon, anchor='w', tags=('toggle', node_id))
            self.canvas.tag_bind(toggle, '<ButtonPress-1>', lambda event, nid=node_id: self.toggle_node(nid))

        # テキストを左揃えで配置
        font = self.bold_font if node.get('bold', False) else self.default_font
        text = self.canvas.create_text(
            x - width / 2 + 5,
            y,
            text=node['name'],
            fill=node['color'],
            width=width - 10,
            anchor='w',
            font=font
        )

        # ノードのイベントバインドをメソッドで定義
        self.canvas.tag_bind(rect, '<ButtonPress-1>', lambda event, nid=node_id: self.on_node_press(event, nid))
        self.canvas.tag_bind(text, '<ButtonPress-1>', lambda event, nid=node_id: self.on_node_press(event, nid))
        self.canvas.tag_bind(rect, '<B1-Motion>', self.do_drag)
        self.canvas.tag_bind(text, '<B1-Motion>', self.do_drag)
        self.canvas.tag_bind(rect, '<ButtonRelease-1>', self.on_node_release)
        self.canvas.tag_bind(text, '<ButtonRelease-1>', self.on_node_release)
        self.canvas.tag_bind(rect, '<Double-1>', lambda event, nid=node_id: self.edit_node_inplace(nid))
        self.canvas.tag_bind(text, '<Double-1>', lambda event, nid=node_id: self.edit_node_inplace(nid))

        # ノードのウィジェットを保存
        self.node_widgets[node_id] = (rect, text)

        self.node_order.append(node_id)
        
    def toggle_node(self, node_id):
        node = self.nodes[node_id]
        node['expanded'] = not node.get('expanded', True)
        self.populate_tree()

    def change_font(self):
        available_fonts = self.get_available_fonts()
        font = simpledialog.askstring("フォント変更", "新しいフォントを選択してください:", initialvalue=self.default_font.actual()['family'])
        if font and font in available_fonts:
            self.default_font.configure(family=font)
            self.bold_font.configure(family=font)
            self.populate_tree()
        elif font:
            messagebox.showwarning("警告", f"選択されたフォント '{font}' は利用できません。")

    def get_available_fonts(self):
        return sorted(list(tkfont.families()))

    def find_best_font(self, preferred_fonts):
        available_fonts = self.get_available_fonts()
        for font in preferred_fonts:
            if font in available_fonts:
                return font
        return "Arial"  # デフォルトフォールバック
    
    def toggle_bold(self):
        if self.selected_node_id:
            node = self.nodes[self.selected_node_id]
            node['bold'] = not node.get('bold', False)
            self.populate_tree()
            
    def toggle_bold_shortcut(self, event=None):
        self.toggle_bold()
        return 'break'

    def on_node_press(self, event, node_id):
        self.last_selected_node_id = self.selected_node_id  # 前回の選択を保存
        self.dragging_node = node_id
        self.selected_node_id = node_id
        self.update_node_styles()

        # イベント座標をキャンバス座標に変換
        event_x = self.canvas.canvasx(event.x)
        event_y = self.canvas.canvasy(event.y)

        # ドラッグ開始時のカーソル位置とノード位置のオフセットを計算
        x, y = self.node_positions[node_id]
        self.drag_offset_x = x - event_x
        self.drag_offset_y = y - event_y

        # ドラッグ開始位置を記録
        self.drag_start_x = event_x
        self.drag_start_y = event_y

        # ドラッグ開始フラグを初期化
        self.drag_started = False

    def on_node_release(self, event):
        if self.dragging_node:
            if self.drag_started:
                self.stop_drag(event)
            else:
                # ドラッグが開始されていない場合はクリックとして処理
                pass  # 必要に応じて追加の処理を行う
            # ドラッグ状態をリセット
            self.dragging_node = None
            self.drag_started = False

    def on_node_click(self, event, node_id):
        self.selected_node_id = node_id
        self.update_node_styles()

    def update_node_styles(self):
        for node_id, widgets in self.node_widgets.items():
            rect, text = widgets
            if node_id == self.selected_node_id:
                self.canvas.itemconfig(rect, fill='lightblue')
            else:
                self.canvas.itemconfig(rect, fill='')  # 背景色を透明に設定

    def start_drag(self, event, node_id):
        self.dragging_node = node_id
        node = self.nodes[node_id]

        # イベント座標をキャンバス座標に変換
        event_x = self.canvas.canvasx(event.x)
        event_y = self.canvas.canvasy(event.y)

        # ドラッグ開始時のカーソル位置とノード位置のオフセットを計算
        x, y = self.node_positions[node_id]
        self.drag_offset_x = x - event_x
        self.drag_offset_y = y - event_y

        # ドラッグ開始位置を記録
        self.drag_start_x = event_x
        self.drag_start_y = event_y

        # ドラッグ開始フラグを初期化
        self.drag_started = False

        self.canvas.bind('<Motion>', self.do_drag)

    def do_drag(self, event):
        if self.dragging_node:
            # イベント座標をキャンバス座標に変換
            event_x = self.canvas.canvasx(event.x)
            event_y = self.canvas.canvasy(event.y)

            # ドラッグ開始していない場合、移動距離を計算
            if not self.drag_started:
                dx = abs(event_x - self.drag_start_x)
                dy = abs(event_y - self.drag_start_y)
                if dx < 5 and dy < 5:
                    # 移動距離が閾値未満の場合、何もしない
                    return
                else:
                    # 移動距離が閾値を超えたらドラッグ開始
                    self.drag_started = True
                    # ドラッグ中の一時的なテキストアイテムを作成
                    node = self.nodes[self.dragging_node]
                    text = node['name']
                    color = node['color']
                    self.dragged_item = self.canvas.create_text(event_x + self.drag_offset_x, event_y + self.drag_offset_y, text=text, fill=color, anchor='c', font=('TkDefaultFont', 9))
                    self.canvas.lift(self.dragged_item)

            if self.drag_started:
                # 一時的なテキストアイテムをマウス位置に移動（オフセットを考慮）
                new_x = event_x + self.drag_offset_x
                new_y = event_y + self.drag_offset_y
                self.canvas.coords(self.dragged_item, new_x, new_y)

                # ドロップ先のハイライトを更新
                self.update_drop_highlight(event_x, event_y)

    def stop_drag(self, event):
        if self.dragging_node:
            self.canvas.unbind('<Motion>')

            if self.drag_started:
                # イベント座標をキャンバス座標に変換
                event_x = self.canvas.canvasx(event.x)
                event_y = self.canvas.canvasy(event.y)

                # ドラッグ先のノードを特定
                x, y = event_x, event_y
                overlapping = self.canvas.find_overlapping(x, y, x, y)
                target_node_id = None
                for item in overlapping:
                    for nid, widgets in self.node_widgets.items():
                        if item in widgets and nid != self.dragging_node:
                            target_node_id = nid
                            break
                    if target_node_id:
                        break

                if target_node_id:
                    rect, _ = self.node_widgets[target_node_id]
                    x1, y1, x2, y2 = self.canvas.coords(rect)
                    if y < y1 + (y2 - y1) * 0.3:
                        # 上部30%にドロップした場合、前に挿入
                        self.move_node_as_sibling_before(self.dragging_node, target_node_id)
                    elif y > y2 - (y2 - y1) * 0.3:
                        # 下部30%にドロップした場合、後に挿入
                        self.move_node_as_sibling_after(self.dragging_node, target_node_id)
                    else:
                        # 中央部分にドロップした場合、子ノードとして挿入
                        self.move_node(self.dragging_node, target_node_id)
                else:
                    # ルートレベルに移動
                    self.move_node(self.dragging_node, None)

                # 一時的なテキストアイテムを削除
                self.canvas.delete(self.dragged_item)
                self.dragged_item = None

                # ドロップハイライトを削除
                if self.drop_highlight:
                    self.canvas.delete(self.drop_highlight)
                    self.drop_highlight = None

                # 挿入ガイドラインを削除
                if self.insert_line:
                    self.canvas.delete(self.insert_line)
                    self.insert_line = None

                # ツリーを再描画
                self.populate_tree()
            else:
                # ドラッグが開始されていない場合、クリックとして処理
                pass  # 必要ならクリック時の処理を追加

            # ドラッグ状態をリセット
            self.dragging_node = None
            self.drag_started = False

    def update_drop_highlight(self, x, y):
        # 既存のハイライトを削除
        if self.drop_highlight:
            self.canvas.delete(self.drop_highlight)
            self.drop_highlight = None

        if self.insert_line:
            self.canvas.delete(self.insert_line)
            self.insert_line = None

        overlapping = self.canvas.find_overlapping(x, y, x, y)
        target_node_id = None
        for item in overlapping:
            for nid, widgets in self.node_widgets.items():
                if item in widgets and nid != self.dragging_node:
                    target_node_id = nid
                    break
            if target_node_id:
                break

        if target_node_id:
            rect, _ = self.node_widgets[target_node_id]
            x1, y1, x2, y2 = self.canvas.coords(rect)
            if y < y1 + (y2 - y1) * 0.3:
                # 上部30%にいる場合、挿入ガイドラインを表示
                self.insert_line = self.canvas.create_line(x1, y1, x2, y1, fill='blue', width=2)
            elif y > y2 - (y2 - y1) * 0.3:
                # 下部30%にいる場合、挿入ガイドラインを表示
                self.insert_line = self.canvas.create_line(x1, y2, x2, y2, fill='blue', width=2)
            else:
                # 中央部分にいる場合、ノードをハイライト
                self.drop_highlight = self.canvas.create_rectangle(x1, y1, x2, y2, outline='red', width=2)


    def move_node_as_sibling_before(self, node_id, sibling_id):
        node = self.nodes[node_id]
        sibling = self.nodes[sibling_id]
        old_parent_id = node['parent_id']
        new_parent_id = sibling['parent_id']

        # 自身または子孫を親にすることを防ぐ
        if new_parent_id == node_id or self.is_descendant(new_parent_id, node_id):
            messagebox.showwarning("無効な操作", "ノードを自身または子孫に移動することはできません。")
            return

        # 現在の親からノードを削除
        if old_parent_id is not None:
            self.nodes[old_parent_id]['children'].remove(node_id)
        else:
            self.root_nodes.remove(node_id)

        # 新しい親にノードを追加
        if new_parent_id is not None:
            index = self.nodes[new_parent_id]['children'].index(sibling_id)
            self.nodes[new_parent_id]['children'].insert(index, node_id)
        else:
            index = self.root_nodes.index(sibling_id)
            self.root_nodes.insert(index, node_id)
        self.nodes[node_id]['parent_id'] = new_parent_id

        # アクションを記録
        action = ('move_sibling_before', node_id, old_parent_id, new_parent_id)
        self.undo_stack.append(action)
        self.redo_stack.clear()
        self.is_modified = True

        # 移動したノードを選択状態にする
        self.selected_node_id = node_id

    def move_node_as_sibling_after(self, node_id, sibling_id):
        node = self.nodes[node_id]
        sibling = self.nodes[sibling_id]
        old_parent_id = node['parent_id']
        new_parent_id = sibling['parent_id']

        # 自身または子孫を親にすることを防ぐ
        if new_parent_id == node_id or self.is_descendant(new_parent_id, node_id):
            messagebox.showwarning("無効な操作", "ノードを自身または子孫に移動することはできません。")
            return

        # 現在の親からノードを削除
        if old_parent_id is not None:
            self.nodes[old_parent_id]['children'].remove(node_id)
        else:
            self.root_nodes.remove(node_id)

        # 新しい親にノードを追加
        if new_parent_id is not None:
            index = self.nodes[new_parent_id]['children'].index(sibling_id) + 1
            self.nodes[new_parent_id]['children'].insert(index, node_id)
        else:
            index = self.root_nodes.index(sibling_id) + 1
            self.root_nodes.insert(index, node_id)
        self.nodes[node_id]['parent_id'] = new_parent_id

        # アクションを記録
        action = ('move_sibling_after', node_id, old_parent_id, new_parent_id)
        self.undo_stack.append(action)
        self.redo_stack.clear()
        self.is_modified = True

        # 移動したノードを選択状態にする
        self.selected_node_id = node_id

    def move_node(self, node_id, new_parent_id):
        # 循環参照を防止
        if new_parent_id == node_id or self.is_descendant(new_parent_id, node_id):
            messagebox.showwarning("無効な操作", "ノードを自身の子孫に移動することはできません。")
            return
        old_parent_id = self.nodes[node_id]['parent_id']
        if old_parent_id is not None:
            self.nodes[old_parent_id]['children'].remove(node_id)
        else:
            self.root_nodes.remove(node_id)

        if new_parent_id is not None:
            self.nodes[new_parent_id]['children'].append(node_id)
        else:
            self.root_nodes.append(node_id)
        self.nodes[node_id]['parent_id'] = new_parent_id

        # アクションを記録（Undo用）
        action = ('move', node_id, old_parent_id, new_parent_id)
        self.undo_stack.append(action)
        self.redo_stack.clear()
        self.is_modified = True

        # 移動したノードを選択状態にする
        self.selected_node_id = node_id

    def is_descendant(self, potential_descendant_id, node_id):
        # potential_descendant_idがnode_idの子孫であるかをチェック
        if potential_descendant_id == node_id:
            return True
        current_id = self.nodes.get(potential_descendant_id, {}).get('parent_id')
        while current_id is not None:
            if current_id == node_id:
                return True
            current_id = self.nodes.get(current_id, {}).get('parent_id')
        return False

    def on_canvas_configure(self, event):
        # キャンバスのスクロールリージョンを更新
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))

    def edit_node_inplace(self, node_id):
        x, y, height = self.node_positions[node_id]
        rect, text_item = self.node_widgets[node_id]
        old_text = self.nodes[node_id]['name']
        width = 150

        # Entryウィジェットを作成
        self.edit_entry = tk.Entry(self.canvas, width=20, font=self.default_font)
        self.edit_entry.insert(0, old_text)
        self.edit_entry_window = self.canvas.create_window(x - width / 2 + 5, y, anchor='w', window=self.edit_entry)

        # フォーカスを設定し、選択状態にする
        self.edit_entry.focus_set()
        self.edit_entry.select_range(0, tk.END)

        # エンターキーで編集を終了
        self.edit_entry.bind('<Return>', lambda e, nid=node_id: self.save_edit(nid))
        # エスケープキーで編集をキャンセル
        self.edit_entry.bind('<Escape>', self.cancel_edit)

        # フォーカスが外れたときに編集を終了
        self.edit_entry.bind('<FocusOut>', lambda e, nid=node_id: self.save_edit(nid))

        # 矢印キーのイベントをバインドしない（デフォルトの動作を維持）
        # self.edit_entry.bind('<Up>', lambda e: 'break')
        # self.edit_entry.bind('<Down>', lambda e: 'break')
        # self.edit_entry.bind('<Left>', lambda e: 'break')
        # self.edit_entry.bind('<Right>', lambda e: 'break')
        
        self.is_editing = True
        self.edit_entry.bind('<FocusOut>', lambda e, nid=node_id: self.save_edit(nid))

    def save_edit(self, node_id, event=None):
        if not hasattr(self, 'edit_entry'):
            return

        new_text = self.edit_entry.get()
        old_text = self.nodes[node_id]['name']

        if new_text != old_text:
            # データを更新
            self.nodes[node_id]['name'] = new_text

            # アクションを記録（Undo用）
            action = ('edit', node_id, old_text)
            self.undo_stack.append(action)
            self.redo_stack.clear()

            # 未保存の変更があることを示す
            self.is_modified = True

        # Entryウィジェットを削除
        if hasattr(self, 'edit_entry_window'):
            self.canvas.delete(self.edit_entry_window)
        if hasattr(self, 'edit_entry'):
            self.edit_entry.destroy()
            del self.edit_entry

        # ツリーを再描画
        self.populate_tree()
        
        self.is_editing = False

    def cancel_edit(self, event=None):
        if hasattr(self, 'edit_entry_window'):
            self.canvas.delete(self.edit_entry_window)
        if hasattr(self, 'edit_entry'):
            self.edit_entry.destroy()
            del self.edit_entry
        self.populate_tree()  # 編集をキャンセルしたら再描画
        
        self.is_editing = False

    def escape_key_action(self, event=None):
        self.last_selected_node_id = self.selected_node_id  # 前回の選択を保存
        self.cancel_edit()
        self.selected_node_id = None
        self.update_node_styles()

    # ノード追加機能（子ノード）
    def add_node(self, event=None):
        if not self.selected_node_id:
            messagebox.showwarning("警告", "親ノードを選択してください")
            return

        parent_id = self.selected_node_id

        # 新しいIDを生成
        new_id = self.generate_new_id()

        # データに新しいノードを追加
        node_name = "新しいノード"
        node_color = 'black'
        self.nodes[new_id] = {
            'id': new_id,
            'name': node_name,
            'parent_id': parent_id,
            'color': node_color,
            'children': [],
            'expanded': True
        }
        self.nodes[parent_id]['children'].append(new_id)

        # アクションを記録（Undo用）
        action = ('add', new_id)
        self.undo_stack.append(action)
        self.redo_stack.clear()

        self.is_modified = True

        # 新しいノードを選択
        self.selected_node_id = new_id

        # ツリーを再描画
        self.populate_tree()

    def add_node_shortcut(self, event=None):
        self.add_node()
        return 'break'

    # 兄弟ノード追加機能
    def add_sibling_node(self, event=None):
        if not self.selected_node_id:
            messagebox.showwarning("警告", "基準となるノードを選択してください")
            return

        current_node = self.nodes[self.selected_node_id]
        parent_id = current_node['parent_id']

        # 新しいIDを生成
        new_id = self.generate_new_id()

        # データに新しいノードを追加
        node_name = "新しいノード"
        node_color = 'black'
        self.nodes[new_id] = {
            'id': new_id,
            'name': node_name,
            'parent_id': parent_id,
            'color': node_color,
            'children': [],
            'expanded': True
        }

        if parent_id is not None:
            # 現在のノードの直後に挿入
            siblings = self.nodes[parent_id]['children']
            index = siblings.index(self.selected_node_id) + 1
            siblings.insert(index, new_id)
        else:
            # ルートレベルにノードを追加
            index = self.root_nodes.index(self.selected_node_id) + 1
            self.root_nodes.insert(index, new_id)
            self.nodes[new_id]['parent_id'] = None

        # アクションを記録（Undo用）
        action = ('add', new_id)
        self.undo_stack.append(action)
        self.redo_stack.clear()

        # 未保存の変更があることを示す
        self.is_modified = True

        # 新しいノードを選択
        self.selected_node_id = new_id

        # ツリーを再描画
        self.populate_tree()


    def add_sibling_node_shortcut(self, event=None):
        self.add_sibling_node()
        return 'break'

    # ノード編集ショートカット
    def edit_node_shortcut(self, event=None):
        if self.selected_node_id:
            self.edit_node_inplace(self.selected_node_id)
        return 'break'

    # ノード削除機能
    def delete_node(self, event=None):
        if not self.selected_node_id:
            return

        node_id = self.selected_node_id

        parent_id = self.nodes[node_id]['parent_id']

        # 子ノードも削除
        def delete_subtree(nid):
            node = self.nodes[nid]
            for child_id in node['children']:
                delete_subtree(child_id)
            del self.nodes[nid]

        delete_subtree(node_id)

        if parent_id is not None and node_id in self.nodes[parent_id]['children']:
            self.nodes[parent_id]['children'].remove(node_id)
        elif parent_id is None and node_id in self.root_nodes:
            self.root_nodes.remove(node_id)

        # アクションを記録（Undo用）
        action = ('delete', node_id)
        self.undo_stack.append(action)
        self.redo_stack.clear()

        self.is_modified = True

        self.selected_node_id = parent_id if parent_id else (self.root_nodes[0] if self.root_nodes else None)
        self.populate_tree()

    # ノードのテキスト色を変更
    def change_text_color(self):
        if not self.selected_node_id:
            messagebox.showwarning("警告", "ノードを選択してください")
            return

        node_id = self.selected_node_id
        old_color = self.nodes[node_id]['color']

        # カラーチューザーを表示
        color_code = colorchooser.askcolor(title="テキストの色を選択")[1]
        if color_code:
            # データを更新
            self.nodes[node_id]['color'] = color_code

            # アクションを記録（Undo用）
            action = ('color', node_id, old_color)
            self.undo_stack.append(action)
            self.redo_stack.clear()

            # 未保存の変更があることを示す
            self.is_modified = True

            # ツリーを再描画
            self.populate_tree()

    # ノードコピー機能
    def copy_node(self, event=None):
        if not self.selected_node_id:
            messagebox.showwarning("警告", "コピーするノードを選択してください")
            return

        node_id = self.selected_node_id
        self.clipboard = self.copy_subtree(node_id)

        # messagebox.showinfo("コピー完了", "ノードをコピーしました。")

    def copy_subtree(self, node_id):
        # 深さ優先探索でノードをコピー
        node = self.nodes[node_id]
        node_copy = {
            'id': node_id,
            'name': node['name'],
            'parent_id': node['parent_id'],
            'color': node['color'],
            'children': [],
            'expanded': node['expanded']
        }
        for child_id in node['children']:
            child_copy = self.copy_subtree(child_id)
            node_copy['children'].append(child_copy)
        return node_copy

    def copy_node_shortcut(self, event=None):
        self.copy_node()
        return 'break'

    # ノードペースト機能
    def paste_node(self, event=None):
        if self.clipboard is None:
            messagebox.showwarning("警告", "コピーされたノードがありません")
            return

        if not self.selected_node_id:
            messagebox.showwarning("警告", "ペースト先の親ノードを選択してください")
            return

        parent_id = self.selected_node_id

        # 新しいIDを割り当てつつ、ノードを追加
        def paste_subtree(node_data, parent_id):
            new_id = self.generate_new_id()
            self.nodes[new_id] = {
                'id': new_id,
                'name': node_data['name'],
                'parent_id': parent_id,
                'color': node_data['color'],
                'children': [],
                'expanded': node_data['expanded']
            }
            if parent_id is not None:
                self.nodes[parent_id]['children'].append(new_id)
            else:
                self.root_nodes.append(new_id)
            for child_data in node_data['children']:
                paste_subtree(child_data, new_id)

        try:
            paste_subtree(self.clipboard, parent_id)
        except Exception as e:
            messagebox.showerror("エラー", f"ペースト中にエラーが発生しました。\n{e}")
            return

        # アクションを記録（Undo用）
        action = ('paste', parent_id)
        self.undo_stack.append(action)
        self.redo_stack.clear()

        self.is_modified = True
        self.populate_tree()

        # messagebox.showinfo("ペースト完了", "ノードをペーストしました。")

    def paste_node_shortcut(self, event=None):
        self.paste_node()
        return 'break'

    # プレーンテキストとしてコピーする機能
    def copy_as_plain_text(self, event=None):
        if not self.selected_node_id:
            messagebox.showwarning("警告", "コピーするノードを選択してください")
            return

        # 選択したノードとその子孫ノードを取得
        node_id = self.selected_node_id
        text = self.get_node_text(node_id)

        # クリップボードにコピー
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        messagebox.showinfo("コピー完了", "ノードをプレーンテキストとしてコピーしました。")

    def copy_as_plain_text_shortcut(self, event=None):
        self.copy_as_plain_text()
        return 'break'

    def get_node_text(self, node_id, depth=0):
        node = self.nodes[node_id]
        text_lines = ['\t' * depth + node['name']]
        for child_id in node['children']:
            text_lines.append(self.get_node_text(child_id, depth + 1))
        return '\n'.join(text_lines)

    # Undo機能
    def undo_action(self, event=None):
        if not self.undo_stack:
            return 'break'

        action = self.undo_stack.pop()
        self.redo_stack.append(action)

        action_type = action[0]

        if action_type == 'add':
            node_id = action[1]
            self.delete_node_by_id(node_id)
        elif action_type == 'delete':
            # 削除されたノードを復元する処理を実装
            self.restore_deleted_node(action[1])
        elif action_type == 'edit':
            node_id, old_text = action[1], action[2]
            self.nodes[node_id]['name'] = old_text
        elif action_type == 'color':
            node_id, old_color = action[1], action[2]
            self.nodes[node_id]['color'] = old_color
        elif action_type == 'paste':
            parent_id = action[1]
            # ペーストしたノードを削除する処理を実装
            self.delete_pasted_nodes(parent_id)
        elif action_type in ['move', 'move_left', 'move_right', 'move_sibling']:
            node_id, old_parent_id, new_parent_id = action[1], action[2], action[3]
            self.move_node(node_id, old_parent_id)

        self.is_modified = True
        self.populate_tree()
        return 'break'

    def restore_deleted_node(self, node_data):
        # 削除されたノードとその子孫を復元する処理を実装
        self.nodes[node_data['id']] = node_data
        if node_data['parent_id']:
            self.nodes[node_data['parent_id']]['children'].append(node_data['id'])
        else:
            self.root_nodes.append(node_data['id'])
        for child_id in node_data['children']:
            self.restore_deleted_node(self.nodes[child_id])

    def delete_pasted_nodes(self, parent_id):
        # ペーストされたノードを削除する処理を実装
        if parent_id:
            children = self.nodes[parent_id]['children']
            pasted_node_id = children[-1]  # 最後にペーストされたノードを想定
            self.delete_node_by_id(pasted_node_id)
        else:
            # ルートレベルにペーストされた場合
            pasted_node_id = self.root_nodes[-1]  # 最後にペーストされたノードを想定
            self.delete_node_by_id(pasted_node_id)
            self.root_nodes.pop()

    # Redo機能
    def redo_action(self, event=None):
        if not self.redo_stack:
            return 'break'

        action = self.redo_stack.pop()
        self.undo_stack.append(action)

        action_type = action[0]

        if action_type == 'add':
            node_id = action[1]
            # ノードを再追加する処理を実装
            messagebox.showwarning("警告", "この操作は現在サポートされていません")
        elif action_type == 'delete':
            node_id = action[1]
            self.delete_node_by_id(node_id)
        elif action_type == 'edit':
            node_id = action[1]
            new_text = self.nodes[node_id]['name']
            self.nodes[node_id]['name'] = new_text
        elif action_type == 'color':
            node_id = action[1]
            new_color = self.nodes[node_id]['color']
            self.nodes[node_id]['color'] = new_color
        elif action_type == 'paste':
            parent_id = action[1]
            # ノードを再度ペーストする処理を実装
            messagebox.showwarning("警告", "この操作は現在サポートされていません")
        elif action_type == 'move':
            node_id, old_parent_id, new_parent_id = action[1], action[2], action[3]
            self.move_node(node_id, new_parent_id)
        elif action_type == 'move_left':
            node_id, old_parent_id, new_parent_id = action[1], action[2], action[3]
            self.move_node(node_id, new_parent_id)
        elif action_type == 'move_right':
            node_id, old_parent_id, new_parent_id = action[1], action[2], action[3]
            self.move_node(node_id, new_parent_id)
        elif action_type == 'move_sibling':
            node_id, old_parent_id, new_parent_id = action[1], action[2], action[3]
            self.move_node(node_id, new_parent_id)

        self.is_modified = True
        self.populate_tree()
        return 'break'

    def delete_node_by_id(self, node_id):
        node = self.nodes.get(node_id)
        if not node:
            return
        parent_id = node['parent_id']
        if parent_id and node_id in self.nodes[parent_id]['children']:
            self.nodes[parent_id]['children'].remove(node_id)
        elif parent_id is None and node_id in self.root_nodes:
            self.root_nodes.remove(node_id)
        for child_id in node['children']:
            self.delete_node_by_id(child_id)
        del self.nodes[node_id]

    # 保存機能
    def save_data(self):
        if self.current_file_path:
            try:
                data_to_save = {
                    'nodes': self.nodes,
                    'root_nodes': self.root_nodes
                }
                with open(self.current_file_path, 'w', encoding='utf-8') as f:
                    json.dump(data_to_save, f, ensure_ascii=False, indent=4)
                messagebox.showinfo("保存完了", "データを保存しました。")
                self.is_modified = False
            except Exception as e:
                messagebox.showerror("エラー", f"データの保存に失敗しました。\n{e}")
        else:
            self.save_data_as()

    def save_data_as(self):
        file_path = filedialog.asksaveasfilename(defaultextension=".jtree",
                                                 filetypes=[("JSON Treeファイル", "*.jtree")])
        if file_path:
            self.current_file_path = file_path
            self.save_data()

    def save_data_shortcut(self, event=None):
        self.save_data()
        return 'break'

    def save_data_as_shortcut(self, event=None):
        self.save_data_as()
        return 'break'

    # ロード機能
    def load_data(self):
        file_path = filedialog.askopenfilename(filetypes=[("JSON Treeファイル", "*.jtree")])
        if file_path:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if not isinstance(data, dict):
                        raise ValueError("不正なデータ形式です。")
                    self.nodes = data['nodes']
                    self.root_nodes = data['root_nodes']
                    # ノードIDを文字列として扱う
                    self.nodes = {str(k): v for k, v in self.nodes.items()}
                    for node in self.nodes.values():
                        node['id'] = str(node['id'])
                        node['parent_id'] = str(node['parent_id']) if node['parent_id'] is not None else None
                        node['children'] = [str(child_id) for child_id in node['children']]
                    self.root_nodes = [str(root_id) for root_id in self.root_nodes]
                    self.current_file_path = file_path
                    self.populate_tree()
                    messagebox.showinfo("ロード完了", "データをロードしました。")
                    self.is_modified = False
            except Exception as e:
                messagebox.showerror("エラー", f"データのロードに失敗しました。\n{e}")


    def load_data_shortcut(self, event=None):
        self.load_data()
        return 'break'
    
    def load_file(self, file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if not isinstance(data, dict):
                    raise ValueError("不正なデータ形式です。")
                self.nodes = data['nodes']
                self.root_nodes = data['root_nodes']
                # ノードIDを文字列として扱う
                self.nodes = {str(k): v for k, v in self.nodes.items()}
                for node in self.nodes.values():
                    node['id'] = str(node['id'])
                    node['parent_id'] = str(node['parent_id']) if node['parent_id'] is not None else None
                    node['children'] = [str(child_id) for child_id in node['children']]
                self.root_nodes = [str(root_id) for root_id in self.root_nodes]
                self.current_file_path = file_path
                self.populate_tree()
                self.is_modified = False
        except Exception as e:
            messagebox.showerror("エラー", f"データのロードに失敗しました。\n{e}")

    # アプリケーションを閉じる際の処理
    def close_window(self):
        if self.root.focus_get() is None or not self.root.winfo_viewable():
            # このウィンドウがアクティブでない場合は何もしない
            return

        if self.is_modified:
            result = messagebox.askyesnocancel("終了確認", "変更が保存されていません。保存しますか？", parent=self.root)
            if result:  # Yes
                self.save_data()
                self.root.destroy()
            elif result is False:  # No
                self.root.destroy()
            else:  # Cancel
                return
        else:
            self.root.destroy()

    def close_window_shortcut(self, event=None):
        self.close_window()
        return 'break'

    def quit_application(self):
        # すべてのウィンドウを確認して閉じる
        for window in self.root.winfo_children():
            if isinstance(window, tk.Toplevel):
                window.destroy()
        self.root.quit()
    
    # ノード選択の移動（矢印キー）
    def select_node_up(self, event=None):
        if self.is_editing:
            return
        if not self.selected_node_id:
            if self.root_nodes:
                self.selected_node_id = self.root_nodes[0]
            else:
                return 'break'
        
        current_x, current_y = self.node_positions[self.selected_node_id][:2]
        closest_node = None
        closest_distance = float('inf')
        
        for node_id, (x, y, _) in self.node_positions.items():
            if y < current_y:
                distance_y = current_y - y
                distance_x = abs(x - current_x)
                # X座標の差に大きな重みを付ける
                distance = distance_y + distance_x * 10
                if distance < closest_distance:
                    closest_node = node_id
                    closest_distance = distance
        
        if closest_node:
            self.selected_node_id = closest_node
            self.update_node_styles()
            self.scroll_to_node(self.selected_node_id)
        return 'break'

    def select_node_down(self, event=None):
        if self.is_editing:
            return
        if not self.selected_node_id:
            if self.root_nodes:
                self.selected_node_id = self.root_nodes[0]
            else:
                return 'break'
        
        current_x, current_y = self.node_positions[self.selected_node_id][:2]
        closest_node = None
        closest_distance = float('inf')
        
        for node_id, (x, y, _) in self.node_positions.items():
            if y > current_y:
                distance_y = y - current_y
                distance_x = abs(x - current_x)
                # X座標の差に大きな重みを付ける
                distance = distance_y + distance_x * 10
                if distance < closest_distance:
                    closest_node = node_id
                    closest_distance = distance
        
        if closest_node:
            self.selected_node_id = closest_node
            self.update_node_styles()
            self.scroll_to_node(self.selected_node_id)
        return 'break'
    
    def select_node_left(self, event=None):
        if self.is_editing:
            return
        if self.selected_node_id:
            parent_id = self.nodes[self.selected_node_id]['parent_id']
            if parent_id:
                self.selected_node_id = parent_id
                self.update_node_styles()
                self.scroll_to_node(self.selected_node_id)
        return 'break'

    def select_node_right(self, event=None):
        if self.is_editing:
            return
        if self.selected_node_id:
            children = self.nodes[self.selected_node_id]['children']
            if children:
                self.selected_node_id = children[0]
                self.update_node_styles()
                self.scroll_to_node(self.selected_node_id)
        return 'break'

    def scroll_to_node(self, node_id):
        if node_id in self.node_positions:
            x, y = self.node_positions[node_id]
            self.canvas.yview_moveto(y / self.canvas.bbox("all")[3])
            self.canvas.xview_moveto(x / self.canvas.bbox("all")[2])

    def new_window_shortcut(self, event=None):
        self.new_window()
        return 'break'

    def new_window(self):
        new_root = tk.Toplevel(self.root)
        new_app = MindMapApp(new_root)
        # 新しいウィンドウが閉じられたときに、そのインスタンスを破棄
        new_root.protocol("WM_DELETE_WINDOW", lambda: self.on_new_window_close(new_root, new_app))

    def on_new_window_close(self, window, app):
        if app.is_modified:
            result = messagebox.askyesnocancel("終了確認", "変更が保存されていません。保存しますか？", parent=window)
            if result:  # Yes
                app.save_data()
                window.destroy()
            elif result is False:  # No
                window.destroy()
            else:  # Cancel
                return
        else:
            window.destroy()

    def select_all(self, event=None):
        # すべてのノードを展開する
        for node_id in self.nodes:
            self.nodes[node_id]['expanded'] = True
        self.populate_tree()
        return 'break'

    # 兄弟ノードの並び替え
    def move_node_up(self, event=None):
        node_id = self.selected_node_id
        node = self.nodes[node_id]
        parent_id = node['parent_id']
        if parent_id is None:
            siblings = self.root_nodes
        else:
            siblings = self.nodes[parent_id]['children']
        index = siblings.index(node_id)
        if index > 0:
            siblings[index], siblings[index - 1] = siblings[index - 1], siblings[index]
            self.is_modified = True
            # ノードを移動後に選択状態を更新
            self.selected_node_id = node_id
            self.populate_tree()

    def move_node_down(self, event=None):
        node_id = self.selected_node_id
        node = self.nodes[node_id]
        parent_id = node['parent_id']
        if parent_id is None:
            siblings = self.root_nodes
        else:
            siblings = self.nodes[parent_id]['children']
        index = siblings.index(node_id)
        if index < len(siblings) - 1:
            siblings[index], siblings[index + 1] = siblings[index + 1], siblings[index]
            self.is_modified = True
            # ノードを移動後に選択状態を更新
            self.selected_node_id = node_id
            self.populate_tree()

    # Ctrl+Leftでノードを左に移動（親の兄弟にする）
    def move_node_left(self, event=None):
        if self.selected_node_id:
            node_id = self.selected_node_id
            node = self.nodes[node_id]
            parent_id = node['parent_id']
            if parent_id:
                grandparent_id = self.nodes[parent_id]['parent_id']
                # 循環参照を防止
                if grandparent_id == node_id or self.is_descendant(grandparent_id, node_id):
                    messagebox.showwarning("無効な操作", "ノードを自身または子孫に移動することはできません。")
                    return
                # 現在の親からノードを削除
                if parent_id is not None:
                    self.nodes[parent_id]['children'].remove(node_id)
                else:
                    self.root_nodes.remove(node_id)
                # 新しい親にノードを追加
                if grandparent_id is not None:
                    self.nodes[grandparent_id]['children'].append(node_id)
                else:
                    self.root_nodes.append(node_id)
                node['parent_id'] = grandparent_id
                # アクションを記録
                action = ('move_left', node_id, parent_id, grandparent_id)
                self.undo_stack.append(action)
                self.redo_stack.clear()
                self.is_modified = True
                self.populate_tree()
        return 'break'

    # Ctrl+Rightでノードを右に移動（前の兄弟の子にする）
    def move_node_right(self, event=None):
        if self.selected_node_id:
            node_id = self.selected_node_id
            node = self.nodes[node_id]
            parent_id = node['parent_id']
            if parent_id:
                siblings = self.nodes[parent_id]['children']
                index = siblings.index(node_id)
                if index > 0:
                    new_parent_id = siblings[index - 1]
                    # 循環参照を防止
                    if new_parent_id == node_id or self.is_descendant(new_parent_id, node_id):
                        messagebox.showwarning("無効な操作", "ノードを自身または子孫に移動することはできません。")
                        return
                    # 現在の親からノードを削除
                    self.nodes[parent_id]['children'].remove(node_id)
                    # 新しい親にノードを追加
                    self.nodes[new_parent_id]['children'].append(node_id)
                    node['parent_id'] = new_parent_id
                    # アクションを記録
                    action = ('move_right', node_id, parent_id, new_parent_id)
                    self.undo_stack.append(action)
                    self.redo_stack.clear()
                    self.is_modified = True
                    self.populate_tree()
        return 'break'

# アプリケーションの実行
if __name__ == "__main__":
    root = tk.Tk()
    
    # 実行環境に応じたスクリプトのディレクトリを取得
    if getattr(sys, 'frozen', False):
        # PyInstallerでコンパイルされた場合
        script_dir = sys._MEIPASS
    else:
        # 通常の実行時
        script_dir = os.path.dirname(os.path.abspath(__file__))
    
    iconfile = os.path.join(script_dir, 'app_icon.ico')
    
    # アイコンファイルの存在確認
    if os.path.exists(iconfile):
        try:
            root.iconbitmap(default=iconfile)
        except tk.TclError as e:
            messagebox.showerror("アイコンエラー", f"アイコンの設定に失敗しました。\n{e}")
    else:
        messagebox.showwarning("アイコンファイル未検出", f"アイコンファイルが見つかりません: {iconfile}")
    
    # コマンドライン引数からファイルパスを取得
    file_path = sys.argv[1] if len(sys.argv) > 1 else None
    
    app = MindMapApp(root, file_path)
    root.mainloop()