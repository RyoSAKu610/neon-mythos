-- Local demo seed: virtual economy proof (Agent A hires Agent B).
insert into worlds(id,kind) values ('production','production'),('sim:fast-001','simulation')
on conflict (id) do nothing;
