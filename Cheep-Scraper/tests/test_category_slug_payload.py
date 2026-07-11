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


def test_exact_match_beats_prefix():
    products = [{"name": "Jabłka", "price": 3.99,
                 "raw_category": "Światy potrzeb/Żywność/Owoce i warzywa/Owoce"}]
    cmap = {
        "Światy potrzeb/Żywność/Owoce i warzywa/Owoce": "meyve",
        "prefix:Światy potrzeb/Żywność/Owoce i warzywa/": "meyve-sebze",
    }
    payloads = build_api_payloads(products, store_id=45, category_map=cmap)
    assert payloads[0]["category_slug"] == "meyve"


def test_longest_prefix_wins():
    products = [{"name": "Ser gouda", "price": 12.5,
                 "raw_category": "Kategorie/Dom & Kuchnia/Sery/Żółte"}]
    cmap = {
        "prefix:Kategorie/Dom & Kuchnia/": "diger",
        "prefix:Kategorie/Dom & Kuchnia/Sery/": "peynir",
    }
    payloads = build_api_payloads(products, store_id=45, category_map=cmap)
    assert payloads[0]["category_slug"] == "peynir"


def test_prefix_no_match_omits_category_slug():
    products = [{"name": "Spodnie", "price": 49.99,
                 "raw_category": "Kategorie/Moda/Moda damska/Dżinsy"}]
    cmap = {"prefix:Kategorie/Dom & Kuchnia/": "diger"}
    payloads = build_api_payloads(products, store_id=45, category_map=cmap)
    assert "category_slug" not in payloads[0]
