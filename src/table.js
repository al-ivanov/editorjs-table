import { create } from "./documentUtils";
import "./styles/table.pcss";

const CSS = {
  table: "tc-table",
  inputField: "tc-table__inp",
  cell: "tc-table__cell",
  wrapper: "tc-table__wrap",
  area: "tc-table__area",
  highlight: "tc-table__highlight",
  merged: "tc-table__merged",
};

/**
 * Generates and manages _table contents.
 */
export class Table {
  /**
   * Creates
   */
  constructor() {
    this._numberOfColumns = 0;
    this._numberOfRows = 0;
    this._element = this._createTableWrapper();
    this._table = this._element.querySelector("table");
    this._selectedCell = null;
    this._attachEvents();
    this.lastSelectedCell = null;
    this.minRowIndex = null;
    this.rowSpan = null;
    this.minColIndex = null;
    this.colSpan = null;
    this.minColToStart = null;
  }

  /**
   * returns selected/editable cell or null if row is not selected
   * @return {HTMLElement|null}
   */
  get selectedCell() {
    return this._selectedCell;
  }

  /**
   * sets a selected cell and highlights it
   * @param cell - new current cell
   */
  set selectedCell(cell) {
    if (this._selectedCell) {
      this._selectedCell.classList.remove(CSS.highlight);
    }

    this._selectedCell = cell;

    if (this._selectedCell) {
      this._selectedCell.classList.add(CSS.highlight);
    }
  }

  /**
   * returns current a row that contains current cell
   * or null if no cell selected
   * @returns {HTMLElement|null}
   */
  get selectedRow() {
    if (!this.selectedCell) return null;

    return this.selectedCell.closest("tr");
  }

  /**
   * Inserts column to the right from currently selected cell
   */
  insertColumnAfter() {
    this.insertColumn(1);
    this.focusCellOnSelectedCell();
  }

  /**
   * Inserts column to the left from currently selected cell
   */
  insertColumnBefore() {
    this.insertColumn();
    this.focusCellOnSelectedCell();
  }

  /**
   * Inserts new row below a current row
   */
  insertRowBefore() {
    this.insertRow();
    this.focusCellOnSelectedCell();
  }

  /**
   * Inserts row above a current row
   */
  insertRowAfter() {
    this.insertRow(1);
    this.focusCellOnSelectedCell();
  }

  /**
   * Insert a column into table relatively to a current cell
   * @param {number} direction - direction of insertion. 0 is insertion before, 1 is insertion after
   */
  insertColumn(direction = 0) {
    direction = Math.min(Math.max(direction, 0), 1);

    const insertionIndex = this.selectedCell
      ? this.selectedCell.cellIndex + direction
      : 0;

    this._numberOfColumns++;
    /** Add cell in each row */
    const rows = this._table.rows;

    for (let i = 0; i < rows.length; i++) {
      const cell = rows[i].insertCell(insertionIndex);

      this._fillCell(cell);
    }
  }

  /**
   * Remove column that includes currently selected cell
   * Do nothing if there's no current cell
   */
  deleteColumn() {
    if (!this.selectedCell) return;

    const removalIndex = this.selectedCell.cellIndex;

    this._numberOfColumns--;
    /** Delete cell in each row */
    const rows = this._table.rows;

    for (let i = 0; i < rows.length; i++) {
      rows[i].deleteCell(removalIndex);
    }
  }

  /**
   * Insert a row into table relatively to a current cell
   * @param {number} direction - direction of insertion. 0 is insertion before, 1 is insertion after
   * @return {HTMLElement} row
   */
  insertRow(direction = 0) {
    direction = Math.min(Math.max(direction, 0), 1);

    const insertionIndex = this.selectedRow
      ? this.selectedRow.rowIndex + direction
      : 0;

    const row = this._table.insertRow(insertionIndex);

    this._numberOfRows++;

    this._fillRow(row);
    return row;
  }

  /**
   * Remove row in table on index place
   * @param {number} index - number in the array of columns, where new column to insert,-1 if insert at the end
   */
  deleteRow(index = -1) {
    if (!this.selectedRow) return;

    const removalIndex = this.selectedRow.rowIndex;

    this._table.deleteRow(removalIndex);
    this._numberOfRows--;
  }

  /**
   * unmerge selected cells
   */
  unmergeCells() {
    const rowspan = parseInt(this._selectedCell.getAttribute("rowspan"));
    const colspan = parseInt(this._selectedCell.getAttribute("colspan"));

    if (!colspan || !rowspan) {
      alert("Невозможно разделить ячейку");
      return;
    }

    const rows = this._table.rows;
    const startRow = this._selectedCell.parentElement;
    const startRowIndex = startRow.rowIndex;
    const startCol = this._selectedCell;
    const startColIndex = startCol.cellIndex;

    for (let i = startRowIndex; i <= startRowIndex + rowspan - 1; i++) {
      if (startColIndex + colspan + 1 <= this._numberOfColumns) {
        for (let j = startColIndex; j <= startColIndex + colspan; j++) {
          if ([...rows[i].cells[j].classList].includes(CSS.merged)) {
            rows[i].cells[j].classList.remove(CSS.merged);
            rows[i].cells[j].removeAttribute("colspan");
            rows[i].cells[j].removeAttribute("rowspan");
          }
          rows[i].cells[j].style.display = "table-cell";
        }
      } else {
        for (let j = startColIndex + colspan - 1; j >= startColIndex; j--) {
          if ([...rows[i].cells[j].classList].includes(CSS.merged)) {
            rows[i].cells[j].classList.remove(CSS.merged);
            rows[i].cells[j].removeAttribute("colspan");
            rows[i].cells[j].removeAttribute("rowspan");
          }
          rows[i].cells[j].style.display = "table-cell";
        }
      }
    }
  }

  /**
   * Merge selected cells
   */
  mergeCells() {
    if (
      this.minRowIndex === null ||
      this.rowSpan === null ||
      this.minColIndex === null ||
      this.colSpan === null ||
      this.minColToStart === null
    ) {
      console.warn("not selected");
      return;
    }

    if (!this._checkPermissionForMerge()) {
      return;
    }

    if (!this._checkIfMergeIsPossible()) {
      alert("Невозможно объединить уже объединённые ячейки");
      return;
    }

    this._mergeCells(
      this.minRowIndex,
      this.rowSpan,
      this.minColIndex,
      this.colSpan,
      this.minColToStart
    );
  }

  _checkPermissionForMerge() {
    const rows = this._table.rows;
    let permission = true;
    let stop = false;

    for (
      let i = this.minRowIndex;
      i <= this.minRowIndex + this.rowSpan && !stop;
      i++
    ) {
      for (
        let j = this.minColIndex;
        j <= this.minColIndex + this.colSpan;
        j++
      ) {
        if (rows[i].cells[j].textContent !== "") {
          permission = confirm(
            "Внимание! В объединяемых ячейках присутствуют данные. При слиянии эти данные могут потеряны. Продолжить?"
          );
          stop = true;
          break;
        }
      }
    }

    return permission;
  }

  _checkIfMergeIsPossible() {
    const rows = this._table.rows;
    let possible = true;

    for (let i = this.minRowIndex; i <= this.minRowIndex + this.rowSpan; i++) {
      for (
        let j = this.minColIndex;
        j <= this.minColIndex + this.colSpan;
        j++
      ) {
        if ([...rows[i].cells[j].classList].includes(CSS.merged)) {
          possible = false;
        }
      }
    }

    return possible;
  }

  _mergeCells(minRow, rowSpan, minCol, colSpan, minColToStart) {
    const rows = this._table.rows;

    minColToStart.setAttribute("rowspan", rowSpan + 1);
    minColToStart.setAttribute("colspan", colSpan + 1);
    minColToStart.classList.add(CSS.merged);

    // Перебираем ячейки между startCell и endCell
    for (let i = minRow; i <= minRow + rowSpan; i++) {
      if (minCol + colSpan + 1 <= this._numberOfColumns) {
        for (let j = minCol; j <= minCol + colSpan; j++) {
          if (![...rows[i].cells[j].classList].includes(CSS.merged)) {
            rows[i].cells[j].style.display = "none";
          }
        }
      } else {
        for (let j = minCol + colSpan; j >= minCol; j--) {
          if (![...rows[i].cells[j].classList].includes(CSS.merged)) {
            rows[i].cells[j].style.display = "none";
          }
        }
      }
    }
  }

  // Функция для выделения ячеек
  selectCells(startCell, endCell) {
    const rows = this._table.rows;
    const startRow = startCell.parentElement;
    const startRowIndex = startRow.rowIndex;
    const startCol = startCell;
    const startColIndex = startCol.cellIndex;
    const endRow = endCell.parentElement;
    const endRowIndex = endRow.rowIndex;
    const endCol = endCell;
    const endColIndex = endCol.cellIndex;

    this.minRowIndex = Math.min(startRowIndex, endRowIndex);
    this.minColIndex = Math.min(startColIndex, endColIndex);
    this.rowSpan = Math.abs(startRowIndex - endRowIndex);
    this.colSpan = Math.abs(startColIndex - endColIndex);

    const minRowToStart = this._table.querySelectorAll("tr")[this.minRowIndex];
    this.minColToStart = minRowToStart.querySelectorAll("td")[this.minColIndex];

    for (let i = this.minRowIndex; i <= this.minRowIndex + this.rowSpan; i++) {
      for (
        let j = this.minColIndex;
        j <= this.minColIndex + this.colSpan;
        j++
      ) {
        rows[i].cells[j].classList.add(CSS.highlight);
      }
    }

    // this._mergeCells(this.minRowIndex, this.rowSpan, this.minColIndex, this.colSpan, this.minColToStart);
  }

  /**
   * get html table wrapper
   * @return {HTMLElement}
   */
  get htmlElement() {
    return this._element;
  }

  /**
   * get real table tag
   * @return {HTMLElement}
   */
  get body() {
    return this._table;
  }

  /**
   * @private
   *
   * Creates table structure
   * @return {HTMLElement} tbody - where rows will be
   */
  _createTableWrapper() {
    return create("div", [CSS.wrapper], null, [
      create("table", [CSS.table]),
      // This function can be updated so that it will render the table with the give config instead of 3x3
    ]);
  }

  /**
   * @private
   *
   * Create editable area of cell
   * @return {HTMLElement} - the area
   */
  _createContenteditableArea() {
    return create("div", [CSS.inputField], { contenteditable: "true" });
  }

  /**
   * @private
   *
   * Fills the empty cell of the editable area
   * @param {HTMLElement} cell - empty cell
   */
  _fillCell(cell) {
    cell.classList.add(CSS.cell);
    const content = this._createContenteditableArea();
    cell.appendChild(create("div", [CSS.area], null, [content]));
  }

  /**
   * @private
   *
   * Fills the empty row with cells  in the size of numberOfColumns
   * @param row = the empty row
   */
  _fillRow(row) {
    for (let i = 0; i < this._numberOfColumns; i++) {
      const cell = row.insertCell();

      this._fillCell(cell);
    }
  }

  _resetMergeFields() {
    this.minRowIndex = null;
    this.rowSpan = null;
    this.minColIndex = null;
    this.colSpan = null;
  }

  /**
   * @private
   *
   * hang necessary events
   */
  _attachEvents() {
    this._table.addEventListener(
      "focus",
      (event) => {
        const rows = this._table.rows;
        for (let i = 0; i < this._numberOfRows; i++) {
          for (let j = 0; j < this._numberOfColumns; j++) {
            rows[i].cells[j].classList.remove(CSS.highlight);
          }
        }
        this._resetMergeFields();
        this._focusEditField(event);
      },
      true
    );

    this._table.addEventListener("keydown", (event) => {
      this._pressedEnterInEditField(event);
    });

    this._table.addEventListener("click", (event) => {
      const clickedCell = event.target.closest("td");
      const clickedInnerConnent = [...event.target.classList].includes(
        CSS.inputField
      ); // небольшой костыль. Был сделан т.к внутри td еще разметка, которая добавляет отступы и если кликать по этому отсупу то не будет происходить выбор индексов ячейки, но при этом будет появляться подсветка
      if (clickedCell && clickedInnerConnent) {
        if (event.shiftKey && this.lastSelectedCell) {
          // Если зажата клавиша Shift, выделяем все ячейки между текущей и предыдущей выбранной ячейкой
          this.selectCells(this.lastSelectedCell, clickedCell);
        } else {
          // Если Shift не зажат, просто выделяем одну ячейку
          // clickedCell.classList.toggle('selected');
        }

        // Обновляем информацию о последней выбранной ячейке
        this.lastSelectedCell = clickedCell;
      }
      this._clickedOnCell(event);
    });

    this.htmlElement.addEventListener("keydown", (event) => {
      this._containerKeydown(event);
    });
  }

  /**
   * @private
   *
   * When you focus on an editable field, remembers the cell
   * @param {FocusEvent} event
   */
  _focusEditField(event) {
    this.selectedCell =
      event.target.tagName === "TD" ? event.target : event.target.closest("td");
  }
  focusCellOnSelectedCell() {
    this.selectedCell.childNodes[0].childNodes[0].focus();
  }
  /**
   * @private
   *
   * When enter is pressed when editing a field
   * @param {KeyboardEvent} event
   */
  _pressedEnterInEditField(event) {
    if (!event.target.classList.contains(CSS.inputField)) {
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
    }
  }

  /**
   * @private
   *
   * When clicking on a cell
   * @param {MouseEvent} event
   */
  _clickedOnCell(event) {
    if (!event.target.classList.contains(CSS.cell)) {
      return;
    }
    const content = event.target.querySelector("." + CSS.inputField);

    content.focus();
  }

  /**
   * @private
   *
   * detects button presses when editing a table's content
   * @param {KeyboardEvent} event
   */
  _containerKeydown(event) {
    if (event.key === "Enter" && event.ctrlKey) {
      this._containerEnterPressed(event);
    }
    if (event.ctrlKey && event.altKey && event.shiftKey && event.key === "J") {
      this.mergeCells();
    }
    if (event.ctrlKey && event.altKey && event.shiftKey && event.key === "K") {
      this.unmergeCells();
    }
  }

  /**
   * @private
   *
   * if "Ctrl + Enter" is pressed then create new line under current and focus it
   * @param {KeyboardEvent} event
   */
  _containerEnterPressed(event) {
    const newRow = this.insertRow(1);

    newRow.cells[0].click();
  }
}
