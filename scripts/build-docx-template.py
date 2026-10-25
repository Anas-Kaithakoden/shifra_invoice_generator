#!/usr/bin/env python3
"""Build the dynamic Word template used by the invoice generator.

The original Shifra Nuha proforma invoice is kept untouched in
templates/source/. This script makes one copy, replaces only the sample
values with docxtemplater tags, removes the sample item rows (the first row
becomes the repeating row), and keeps every other piece of Word formatting
intact. Run with: npm run template
"""

from __future__ import annotations

import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "templates" / "source" / "Shifra_Nuha_Proforma_Invoice_Template.docx"
OUTPUT = ROOT / "public" / "templates" / "shifra-invoice-template.docx"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def paragraph_span(text: str, marker: str, skip_current: bool = False) -> tuple[int, int]:
    """Find the <w:p> that follows the paragraph containing marker."""
    marker_pos = text.find(marker)
    if marker_pos == -1:
        raise RuntimeError(f"Could not find marker: {marker}")
    current_end = text.find("</w:p>", marker_pos)
    if current_end == -1:
        raise RuntimeError("Malformed XML around marker")
    if skip_current:
        start = text.find("<w:p ", current_end)
    else:
        start = text.rfind("<w:p ", 0, marker_pos)
    end = text.find("</w:p>", start)
    if start == -1 or end == -1:
        raise RuntimeError("Could not find paragraph")
    return start, end + len("</w:p>")


def replace_paragraph_after(text: str, marker: str, tag: str) -> str:
    start, end = paragraph_span(text, marker, skip_current=True)
    paragraph = text[start:end]
    match = re.search(r"<w:pPr>.*?</w:pPr>", paragraph, re.S)
    if not match:
        raise RuntimeError(f"Paragraph after {marker} has no pPr")
    ppr = match.group(0)
    new_paragraph = (
        "<w:p>"
        + ppr
        + '<w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr>'
        + f'<w:t xml:space="preserve">{tag}</w:t></w:r></w:p>'
    )
    return text[:start] + new_paragraph + text[end:]


def table_span(text: str, marker: str) -> tuple[int, int]:
    marker_pos = text.find(marker)
    if marker_pos == -1:
        raise RuntimeError(f"Could not find table marker: {marker}")
    start = text.rfind("<w:tbl>", 0, marker_pos)
    end = text.find("</w:tbl>", marker_pos)
    if start == -1 or end == -1:
        raise RuntimeError("Could not find table")
    return start, end + len("</w:tbl>")


def set_cell_text(row: str, cell_index: int, text: str, keep_run_props: bool = True) -> str:
    cells = list(re.finditer(r"<w:tc>.*?</w:tc>", row, re.S))
    if cell_index >= len(cells):
        raise RuntimeError(f"Cell {cell_index} not found in item row")
    cell_match = cells[cell_index]
    cell = cell_match.group(0)
    ppr_match = re.search(r"<w:pPr>.*?</w:pPr>", cell, re.S)
    ppr = ppr_match.group(0) if ppr_match else ""
    rpr_match = re.search(r"<w:rPr>.*?</w:rPr>", cell, re.S)
    rpr = rpr_match.group(0) if (keep_run_props and rpr_match) else ""
    new_cell = (
        cell[: cell.find("<w:p ")]
        + f'<w:p>{ppr}<w:r>{rpr}<w:t xml:space="preserve">{text}</w:t></w:r></w:p>'
        + "</w:tc>"
    )
    return row[: cell_match.start()] + new_cell + row[cell_match.end() :]


def add_keep_next(block: str) -> str:
    return block.replace("<w:pPr>", "<w:pPr><w:keepNext/>")


def wrap_summary_and_bank(block: str) -> str:
    """Put the summary and bank details in one unsplittable table row.

    Word only applies keep-with-next reliably within a table, not between
    two separate tables. A single borderless outer cell keeps the payment
    summary, divider and bank details together on the same page while the
    nested tables retain their original widths, borders and alignment.
    """
    border = '<w:{0} w:val="none" w:sz="0" w:space="0" w:color="FFFFFF"/>'
    no_borders = "".join(
        border.format(side)
        for side in (
            "top",
            "left",
            "bottom",
            "right",
            "insideH",
            "insideV",
        )
    )
    no_margin = (
        "<w:tblCellMar>"
        '<w:top w:w="0" w:type="dxa"/>'
        '<w:left w:w="0" w:type="dxa"/>'
        '<w:bottom w:w="0" w:type="dxa"/>'
        '<w:right w:w="0" w:type="dxa"/>'
        "</w:tblCellMar>"
    )
    return (
        "<w:tbl>"
        "<w:tblPr>"
        '<w:tblW w:w="9638" w:type="dxa"/>'
        f"<w:tblBorders>{no_borders}</w:tblBorders>"
        '<w:tblLayout w:type="fixed"/>'
        f"{no_margin}"
        "</w:tblPr>"
        "<w:tblGrid><w:gridCol w:w=\"9638\"/></w:tblGrid>"
        "<w:tr><w:trPr><w:cantSplit/></w:trPr>"
        '<w:tc><w:tcPr><w:tcW w:w="9638" w:type="dxa"/>'
        f"{no_margin}"
        "</w:tcPr>"
        f"{block}"
        '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" '
        'w:lineRule="exact"/></w:pPr></w:p>'
        "</w:tc></w:tr></w:tbl>"
    )


def build() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Original Word template not found: {SOURCE}")

    with zipfile.ZipFile(SOURCE) as source_zip:
        parts = {name: source_zip.read(name) for name in source_zip.namelist()}

    document = parts["word/document.xml"].decode("utf-8")

    # ---- Header / client / service fields ---------------------------------
    document = replace_once(
        document,
        '<w:t>[Client / Business Name]</w:t>',
        '<w:t xml:space="preserve">{clientName}</w:t>',
        "client name",
    )
    document = replace_once(
        document,
        '<w:t>[Client Address]</w:t>',
        '<w:t xml:space="preserve">{clientAddress}</w:t>',
        "client address",
    )
    document = replace_once(
        document,
        '<w:t>[Client Phone / Email]</w:t>',
        '<w:t xml:space="preserve">{clientContact}</w:t>',
        "client contact",
    )
    document = replace_paragraph_after(document, "<w:t>SERVICE</w:t>", "{serviceName}")

    # ---- Proforma number: three runs become one tagged run ---------------
    old_number = (
        '<w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr>'
        "<w:t>SNT-PI-</w:t></w:r>"
        '<w:r w:rsidR="00E36E5B"><w:rPr><w:b/><w:bCs/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr>'
        "<w:t>2026-</w:t></w:r>"
        '<w:r w:rsidR="00FD0A78"><w:rPr><w:b/><w:bCs/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr>'
        "<w:t>101</w:t></w:r>"
    )
    new_number = (
        '<w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr>'
        '<w:t xml:space="preserve">{proformaNumber}</w:t></w:r>'
    )
    document = replace_once(document, old_number, new_number, "proforma number")

    # ---- Date: clean the centred/leading-space hack, tag the date -------
    date_start = document.find('w14:paraId="4ED4033C"')
    if date_start == -1:
        raise RuntimeError("Date paragraph not found")
    date_start = document.rfind("<w:p ", 0, date_start)
    date_end = document.find("</w:p>", date_start) + len("</w:p>")
    date_paragraph = document[date_start:date_end]
    date_paragraph = date_paragraph.replace(
        '<w:t xml:space="preserve">                 </w:t>', ""
    )
    date_paragraph = date_paragraph.replace(
        '<w:jc w:val="center"/>', '<w:jc w:val="right"/>'
    )
    old_date_runs = (
        '<w:r w:rsidR="00000000"><w:rPr><w:b/><w:bCs/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr>'
        "<w:t>[</w:t></w:r>"
        '<w:proofErr w:type="gramEnd"/>'
        '<w:r w:rsidR="00000000"><w:rPr><w:b/><w:bCs/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr>'
        "<w:t>DD/MM/YYYY]</w:t></w:r>"
    )
    new_date_run = (
        '<w:r w:rsidR="00000000"><w:rPr><w:b/><w:bCs/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr>'
        '<w:t xml:space="preserve">{invoiceDate}</w:t></w:r>'
    )
    if old_date_runs not in date_paragraph:
        raise RuntimeError("Date placeholder runs not found")
    date_paragraph = date_paragraph.replace(old_date_runs, new_date_run, 1)
    document = document[:date_start] + date_paragraph + document[date_end:]

    # ---- Items table: turn the first sample row into the repeating row --
    table_start, table_end = table_span(document, "<w:t>DESCRIPTION</w:t>")
    table = document[table_start:table_end]
    rows = list(re.finditer(r"<w:tr\b.*?</w:tr>", table, re.S))
    if len(rows) < 2:
        raise RuntimeError("Items table has no data row")
    header_row = rows[0].group(0)
    item_row = rows[1].group(0)
    item_row = set_cell_text(item_row, 0, "{#items}{description}")
    item_row = set_cell_text(item_row, 1, "{qty}")
    item_row = set_cell_text(item_row, 2, "{amount}{/items}")
    item_row = item_row.replace(
        "<w:trPr><w:trHeight", "<w:trPr><w:cantSplit/><w:trHeight", 1
    )
    if "<w:cantSplit/>" not in item_row:
        raise RuntimeError("Could not add cantSplit to the item row")
    # Keep only the header and the tagged row; the remaining sample rows
    # are replaced by the user's dynamic rows at generation time.
    new_table = table[: rows[0].start()] + header_row + item_row + "</w:tbl>"
    document = document[:table_start] + new_table + document[table_end:]

    # ---- Payment summary labels and values ------------------------------
    document = replace_once(
        document,
        "<w:t>Estimated Total</w:t>",
        '<w:t xml:space="preserve">{totalLabel}</w:t>',
        "estimated total label",
    )
    document = replace_once(
        document,
        "<w:t>Amount Payable in Advance</w:t>",
        '<w:t xml:space="preserve">{advanceLabel}</w:t>',
        "advance label",
    )
    document = replace_once(
        document,
        "<w:t>Balance</w:t>",
        '<w:t xml:space="preserve">{balanceLabel}</w:t>',
        "balance label",
    )
    document = replace_once(document, "₹[TOTAL]", "{total}", "estimated total value")

    summary_start, summary_end = table_span(document, "{totalLabel}")
    summary = document[summary_start:summary_end]
    summary = summary.replace("<w:t>₹</w:t>", "<w:t>{advance}</w:t>", 1)
    summary = summary.replace("<w:t>19,200</w:t>", "<w:t></w:t>", 1)
    summary = summary.replace("<w:t>₹</w:t>", "<w:t>{balance}</w:t>", 1)
    summary = summary.replace("<w:t>19,200</w:t>", "<w:t></w:t>", 1)
    if "19,200" in summary or "<w:t>₹</w:t>" in summary:
        raise RuntimeError("Could not replace all sample summary values")
    summary = add_keep_next(summary)
    document = document[:summary_start] + summary + document[summary_end:]

    # Keep the summary separated from the following bank details in a
    # predictable way rather than allowing an awkward page split.
    bank_start, bank_end = table_span(document, "ACCOUNT HOLDER")
    bank = add_keep_next(document[bank_start:bank_end])
    document = document[:bank_start] + bank + document[bank_end:]

    # Keep the divider just before the bank details with the block below it.
    divider_marker = '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="D9DEE5"/></w:pBdr>'
    divider_pos = document.find(divider_marker)
    if divider_pos != -1:
        p_start = document.rfind("<w:p ", 0, divider_pos)
        p_end = document.find("</w:p>", divider_pos) + len("</w:p>")
        paragraph = document[p_start:p_end]
        paragraph = paragraph.replace("<w:pPr>", "<w:pPr><w:keepNext/>", 1)
        document = document[:p_start] + paragraph + document[p_end:]

    # Word can still push the bank details to another page when they are in a
    # separate table. Bind the summary, divider and bank tables into one
    # borderless, unsplittable outer row so they move together as a block.
    summary_start, summary_end = table_span(document, "{totalLabel}")
    bank_start, bank_end = table_span(document, "ACCOUNT HOLDER")
    if bank_start < summary_end:
        raise RuntimeError("Bank details must follow the payment summary")
    summary_and_bank = wrap_summary_and_bank(document[summary_start:bank_end])
    document = (
        document[:summary_start] + summary_and_bank + document[bank_end:]
    )

    # ---- Write the new docx, preserving every other package part --------
    parts["word/document.xml"] = document.encode("utf-8")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temp_output = OUTPUT.with_suffix(".tmp.docx")
    with zipfile.ZipFile(temp_output, "w", zipfile.ZIP_DEFLATED) as out_zip:
        for name, data in parts.items():
            out_zip.writestr(name, data)
    shutil.move(temp_output, OUTPUT)

    # Also publish the original logo extracted from the Word package.
    logo_output = ROOT / "public" / "shifra-logo.png"
    logo_output.write_bytes(parts["word/media/image1.png"])

    print(f"Built template: {OUTPUT}")
    print(f"Extracted logo: {logo_output}")


if __name__ == "__main__":
    try:
        build()
    except Exception as exc:  # noqa: BLE001 - command-line helper
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
