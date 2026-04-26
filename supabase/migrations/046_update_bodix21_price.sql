-- Update BodiX 21 price from 990.000đ to 499.000đ
update public.programs
set price_vnd = 499000
where slug = 'bodix-21';
