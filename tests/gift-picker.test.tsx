import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { GiftPicker } from "@/components/modules/actions/gift-picker";
import messages from "@/messages/tr.json";

/**
 * Hediye seçici — ızgara render'ı, arama ve seçim.
 * Yayıncı hediyeyi ikonundan tanır; bu yüzden her seçenekte ikon + coin şart.
 */

function renderPicker(props: Parameters<typeof GiftPicker>[0]) {
  return render(
    <NextIntlClientProvider locale="tr" messages={messages}>
      <GiftPicker {...props} />
    </NextIntlClientProvider>,
  );
}

describe("GiftPicker", () => {
  it("tüm katalog ızgarada listelenir, her seçenek ikon + coin gösterir", () => {
    renderPicker({ onChange: vi.fn() });

    const grid = screen.getByRole("radiogroup", { name: "Hediye" });
    const options = within(grid).getAllByRole("radio");
    expect(options).toHaveLength(154);

    const gul = within(grid).getByText("Gül").closest("button")!;
    expect(gul.querySelector("img")).toHaveAttribute("src", "/gifts/gul.png");
    expect(gul).toHaveTextContent("1");
  });

  it("seçili hediye yokken bilgilendirme metni gösterilir", () => {
    renderPicker({ onChange: vi.fn() });
    expect(screen.getByText("Hediye seçilmedi")).toBeInTheDocument();
  });

  it("seçili hediye özette ad + coin ile gösterilir ve aria-checked işaretlenir", () => {
    renderPicker({ value: "turk-kahvesi", onChange: vi.fn() });

    const grid = screen.getByRole("radiogroup", { name: "Hediye" });
    const selected = within(grid).getByRole("radio", { checked: true });
    expect(selected).toHaveTextContent("Türk kahvesi");
    expect(selected).toHaveTextContent("5");
  });

  it("arama Türkçe harflere duyarsız filtreler", async () => {
    const user = userEvent.setup();
    renderPicker({ onChange: vi.fn() });

    await user.type(screen.getByRole("searchbox"), "KAHVE");

    const grid = screen.getByRole("radiogroup", { name: "Hediye" });
    const options = within(grid).getAllByRole("radio");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Türk kahvesi");
  });

  it("eşleşme yoksa boş durum metni gösterilir", async () => {
    const user = userEvent.setup();
    renderPicker({ onChange: vi.fn() });

    await user.type(screen.getByRole("searchbox"), "zzzz");

    expect(screen.getByText("Hediye bulunamadı")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("tıklanan hediye onChange'e tam katalog kaydıyla geçilir", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ onChange });

    const grid = screen.getByRole("radiogroup", { name: "Hediye" });
    await user.click(within(grid).getByText("Konfeti").closest("button")!);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: "konfeti", name: "Konfeti", coins: 100 }),
    );
  });

  it("etkileşim hediyesi coin yerine 'Etkileşim' rozetiyle gösterilir", () => {
    renderPicker({ value: "hazine-kutusu", onChange: vi.fn() });
    expect(screen.getAllByText("Etkileşim").length).toBeGreaterThan(0);
  });
});
