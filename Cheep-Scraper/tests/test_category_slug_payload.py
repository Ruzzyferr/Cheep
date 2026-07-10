from countries._common.foreign_import import build_api_payloads


def test_category_map_resolves_to_slug():
    products = [{"name": "Mleko Łaciate 1L", "price": 4.59, "raw_category": "Nabiał i jaja"}]
    cmap = {"Nabiał i jaja": "dairy-eggs"}
    payloads = build_api_payloads(products, store_id=44, category_map=cmap)
    assert payloads[0]["category_slug"] == "dairy-eggs"


def test_unmapped_category_omitted():
    products = [{"name": "Znicz duży", "price": 9.99, "raw_category": "Dekoracje"}]
    payloads = build_api_payloads(products, store_id=44, category_map={"Nabiał i jaja": "dairy-eggs"})
    assert "category_slug" not in payloads[0]
