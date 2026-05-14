import json

with open('products.json', 'r') as f:
    products = json.load(f)

sql = """-- Supabase SQL Schema for Competition Comparator Tool

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    brand TEXT NOT NULL,
    standard TEXT,
    shade TEXT,
    glazing_type TEXT,
    product_name TEXT NOT NULL,
    vlt FLOAT,
    er FLOAT,
    ir FLOAT,
    shgc FLOAT,
    u_value FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_shade ON products(shade);

-- Insert data
INSERT INTO products (brand, standard, shade, glazing_type, product_name, vlt, er, ir, shgc, u_value)
VALUES
"""

values = []
for p in products:
    name = p['ProductName'].replace("'", "''")
    val = "(" + ", ".join([
        f"'{p['Brand']}'",
        f"'{p['Standard']}'",
        f"'{p['Shade']}'",
        f"'{p['GlazingType']}'",
        f"'{name}'",
        str(p['VLT']),
        str(p['ER']),
        str(p['IR']),
        str(p['SHGC']),
        str(p['UValue'])
    ]) + ")"
    values.append(val)

sql += ",\n".join(values) + ";"

with open('supabase_setup.sql', 'w') as f:
    f.write(sql)

print(f"Generated supabase_setup.sql with {len(products)} products")
