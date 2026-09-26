INSERT OR IGNORE INTO categories (id,name,slug,description) VALUES
('cat-electronics','Electronics','electronics','Phones, accessories, gadgets and electronics.'),
('cat-fashion','Fashion','fashion','Clothing, shoes, bags and accessories.'),
('cat-home','Home & Living','home-living','Useful products for home and everyday life.'),
('cat-beauty','Beauty','beauty','Beauty, personal care and grooming products.'),
('cat-groceries','Groceries','groceries','Food, pantry and household essentials.');

INSERT OR IGNORE INTO site_settings (key,value) VALUES
('bank_name','REPLACE WITH YOUR BANK'),
('bank_account_name','Davilanco Store'),
('bank_account_number','REPLACE WITH YOUR ACCOUNT NUMBER'),
('support_email','support@shop.davilanco.com');
