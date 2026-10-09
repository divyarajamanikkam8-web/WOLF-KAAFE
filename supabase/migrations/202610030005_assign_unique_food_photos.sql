begin;

-- Store the item-specific image digest used by the menu management checks.
alter table public.food_items
  add column if not exists image_sha256 text;

create temporary table wolf_kaafe_photo_assignments (
  id uuid primary key,
  image_url text not null unique,
  image_sha256 text not null unique
) on commit drop;

insert into wolf_kaafe_photo_assignments (id, image_url, image_sha256)
values
  ('627392ed-3c51-4bc0-aaeb-e4a98c257b8d'::uuid, '/food-images/627392ed-3c51-4bc0-aaeb-e4a98c257b8d.webp', '368a88af1bacbdf23e629252f658a80e1184f9764a6bb64415059807aa36e5d6'),
  ('9f500c7e-fd10-4a2a-ad5b-a987b0b3c3bd'::uuid, '/food-images/9f500c7e-fd10-4a2a-ad5b-a987b0b3c3bd.webp', '5942a1b2771ac7b5797d1694c0811c78cba92a01fdac43d583d7fd60a7e61c1a'),
  ('cdcf669b-5f20-4c13-b1cd-364be12f43e2'::uuid, '/food-images/cdcf669b-5f20-4c13-b1cd-364be12f43e2.webp', 'd0fac8ae89063baa19248be9463ac9064eb1f63974ad6aaecd5862f310fd1cda'),
  ('cf24e19e-8dcb-4926-b74b-e68ed2ca8644'::uuid, '/food-images/cf24e19e-8dcb-4926-b74b-e68ed2ca8644.webp', '66c60a8d5a7502175d3f088eadc48ff84457498fd70016c6e8c35996f39bd9b0'),
  ('604af462-a5bf-4942-88ec-86b1757f8c03'::uuid, '/food-images/604af462-a5bf-4942-88ec-86b1757f8c03.webp', 'ed3d84f5aefcddca5f65c9f838c424536469a29671901b2a689618e9df91bd93'),
  ('2e39ecd9-1f51-4428-bf94-25065c29db66'::uuid, '/food-images/2e39ecd9-1f51-4428-bf94-25065c29db66.webp', '2164eb7d5525998ed891b7def28c1618332fae89c48cf6b0ba17dac197a90f6a'),
  ('358ffb6b-ea92-4eca-8d41-41c89ad454f5'::uuid, '/food-images/358ffb6b-ea92-4eca-8d41-41c89ad454f5.webp', 'eec29ffb80c2029a948aba2543caea6fb8734db2f561dda334d2cebe390b13ea'),
  ('4ab31ea6-3929-4298-ad42-4ddb2b9bcbbe'::uuid, '/food-images/4ab31ea6-3929-4298-ad42-4ddb2b9bcbbe.webp', '1caa9b36dff5604474eed2a159ac3ad33ee91c587ae720e2ac314e2c39d002cf'),
  ('7489e7d9-6f28-4e0c-9229-acf99829ccfb'::uuid, '/food-images/7489e7d9-6f28-4e0c-9229-acf99829ccfb.webp', 'e2916eff676183c3f8ebd8d6d3b3562163827bcbfcc26205d440354e99e2b08a'),
  ('57af4db3-a713-4ba0-a962-60316f815dc5'::uuid, '/food-images/57af4db3-a713-4ba0-a962-60316f815dc5.webp', '922dc081f6b9e6d74064b1305ec2c588687550736ccd4fe1edd867b98d9cffcf'),
  ('6c7d85cf-fd49-46b0-8a89-4ed2d1523973'::uuid, '/food-images/6c7d85cf-fd49-46b0-8a89-4ed2d1523973.webp', 'c588470c94ed6f320181bbdc6b73ba305d8f49b47e85524d99ee1b5e97c32d36'),
  ('66d62d9c-10d1-49f0-9561-b60d0f506e3e'::uuid, '/food-images/66d62d9c-10d1-49f0-9561-b60d0f506e3e.webp', '92583c6aefbcd4bd2607f84fceb50562abd9319504cea83f37f32693ec21438a'),
  ('7ed6cf97-a273-4c67-abaa-4a79e9a05af2'::uuid, '/food-images/7ed6cf97-a273-4c67-abaa-4a79e9a05af2.webp', '7e40fee5ce11c994718377afd4099977dcc3f4b98ff34f06744a6625a5e16e89'),
  ('d16f7eac-1739-4739-9c0d-102b90dd4e34'::uuid, '/food-images/d16f7eac-1739-4739-9c0d-102b90dd4e34.webp', 'b1be165ca3239bb95b630be2133399317bc296de99b3a88311a5f4594dcb2b17'),
  ('959028ec-d57d-4dc7-a617-304e17b049f8'::uuid, '/food-images/959028ec-d57d-4dc7-a617-304e17b049f8.webp', 'b3967261eff82b77681abbf6b930c5c035c5a29c03804269a86bc2f283142508'),
  ('65437378-9bc7-45d6-ad15-31f054bc1040'::uuid, '/food-images/65437378-9bc7-45d6-ad15-31f054bc1040.webp', 'f66e40e00ed848757b435856732b0e72e975fd07994c0efee46dca5d5938f0b1'),
  ('4d44fff8-5d1b-495e-8323-29a16878a1cd'::uuid, '/food-images/4d44fff8-5d1b-495e-8323-29a16878a1cd.webp', '9aae01b947f1ea5093750e67895ce54fd186da542f014215cd30f399f13fc2c5'),
  ('00faf01b-e495-42ea-932a-9530d3d37541'::uuid, '/food-images/00faf01b-e495-42ea-932a-9530d3d37541.webp', '9338367afb255f01b32b8a82f2728fafffacc724de85939a802fa6665948274d'),
  ('f438e435-7727-4004-857b-c471f1733921'::uuid, '/food-images/f438e435-7727-4004-857b-c471f1733921.webp', '369bf040550fbd07486d9368fefe52c75ac99552501ec4b832c4add040ad4f57'),
  ('3e3b5b34-5daf-45cc-8933-87bb05a55011'::uuid, '/food-images/3e3b5b34-5daf-45cc-8933-87bb05a55011.webp', '6bb8b787197ac7891b40dd0844340ba3791eadc52cbc996f0d6d9ffa349ee055'),
  ('582857a3-45eb-4ef5-9fb8-63931ca86207'::uuid, '/food-images/582857a3-45eb-4ef5-9fb8-63931ca86207.webp', '967d31867501b01e4c36890d737a427ce88f5cf897cbe1dc165937ca5c621edd'),
  ('c3be513f-5911-49be-8c36-9f1d6dbe4286'::uuid, '/food-images/c3be513f-5911-49be-8c36-9f1d6dbe4286.webp', 'd30a65485a9b25bf7fb36845fac6c17866372fb2459b139dbea32194235f9504'),
  ('daa6f201-5a21-43c1-adad-e10deaf960f0'::uuid, '/food-images/daa6f201-5a21-43c1-adad-e10deaf960f0.webp', 'dbab954ede4866fb374e0361c8b64499720c413c5b7baa4d920d41ba21f3f49e'),
  ('a6c4c47a-87db-4fb9-bf5d-a96f0e79083d'::uuid, '/food-images/a6c4c47a-87db-4fb9-bf5d-a96f0e79083d.webp', 'aaed5bb2a3a1e037d3c51dc399651908ac2e5ff62860b48b86fad56ac15b3024'),
  ('fc1d4a2d-9e7f-445c-b7e6-471c530cb0ad'::uuid, '/food-images/fc1d4a2d-9e7f-445c-b7e6-471c530cb0ad.webp', '301fb21cfecae795a17ab570f02cd491e571d4aef9ac466066c7c68a76e16661'),
  ('c217eff5-410d-47ad-a73b-18144c81e455'::uuid, '/food-images/c217eff5-410d-47ad-a73b-18144c81e455.webp', '5dfb1e4af87582510b77479ed6104cd21b4987d76917f290a328eed42222ee09'),
  ('6e65379f-19bf-40de-bd4c-815db0443e8c'::uuid, '/food-images/6e65379f-19bf-40de-bd4c-815db0443e8c.webp', '0bd63b6971a5978bbc6c4632bc1d600c968ae06c079d378d7b3ddcfd825939b0'),
  ('6b1eeb3b-4fd7-4f64-9688-987587a8884f'::uuid, '/food-images/6b1eeb3b-4fd7-4f64-9688-987587a8884f.webp', 'a633ada00146e18ad31649a1d096e1cb3b2a643bfb19733282bfd48f56b7f3e9'),
  ('dd87aaa1-3f3d-4295-8900-3a7efff670d7'::uuid, '/food-images/dd87aaa1-3f3d-4295-8900-3a7efff670d7.webp', 'b81710bf73ebc65d66ad82ea2c1400498ffb59e48aabedb43ef1b852d72f2478'),
  ('d83adc46-33b8-4607-96a8-1cf79b6d6d4b'::uuid, '/food-images/d83adc46-33b8-4607-96a8-1cf79b6d6d4b.webp', '8f8f72f4685a963623b8eb8f0097f33cc4af97d0bd67c6a602e01e011be763ab'),
  ('9c1a7436-7092-48f2-964f-daab781215a1'::uuid, '/food-images/9c1a7436-7092-48f2-964f-daab781215a1.webp', 'e91aa4b5aa9c2e63b5d16d9285cbc920bac567be5816f804527211af181bae9e'),
  ('b164e725-7fc9-4da6-a16b-9c3a48833f21'::uuid, '/food-images/b164e725-7fc9-4da6-a16b-9c3a48833f21.webp', '197bf9f0247883debf13db364aaf94463571ec04de26102a64a36da7625b3fd2'),
  ('c0185002-974a-406c-bf3d-b272d13ebe30'::uuid, '/food-images/c0185002-974a-406c-bf3d-b272d13ebe30.webp', 'd3b5e4ac86f440e1ed5a958bfa622a4eb8f717bbd71680c83aca02fc5467f8a4'),
  ('6d9fd612-a559-447e-8bb5-2ab6182f28e2'::uuid, '/food-images/6d9fd612-a559-447e-8bb5-2ab6182f28e2.webp', '7fa001e499f87b6f1886fbff731539c7761396ec9337dcd9bb5a9d50047fe44d'),
  ('79342e80-1f6a-4d42-85ae-e4edf94bb20e'::uuid, '/food-images/79342e80-1f6a-4d42-85ae-e4edf94bb20e.webp', '25853228cbb5e45808448e7f04f32981022642ae513cc7b123d239b57b39567a'),
  ('d076ddc1-a273-4a48-9db7-c2a0ff12e134'::uuid, '/food-images/d076ddc1-a273-4a48-9db7-c2a0ff12e134.webp', 'a64b3f8a160b5fdec678a8e94bd0474647bc79f1f1cda429987185f82c6057ee'),
  ('3cd7e9f0-7fb7-47a9-9638-62f340d004be'::uuid, '/food-images/3cd7e9f0-7fb7-47a9-9638-62f340d004be.webp', '23d86a3296c032ce55a1b2ef2e6678f7880f20745eac06edb042d81de58e9f44'),
  ('af1e53a4-24aa-4f5b-be48-fcdbfd9900e5'::uuid, '/food-images/af1e53a4-24aa-4f5b-be48-fcdbfd9900e5.webp', 'a39afb2b36a52817655e0eff8aaceadf963a876cdceeeedfd5ebf3027c757805'),
  ('11d715ba-e855-4295-bfbf-69cc481ebaeb'::uuid, '/food-images/11d715ba-e855-4295-bfbf-69cc481ebaeb.webp', 'db3368df47fdb51b7c58a9c4b102d0f22fb537c33462b8740c9e2ab8faedee61'),
  ('3abc2855-d76a-46c3-9f68-1c81057424d5'::uuid, '/food-images/3abc2855-d76a-46c3-9f68-1c81057424d5.webp', 'd31eaa969f91abce3f4bf140ba0e3f0f3557af3cc865a4ee1c3ee84c499e3826'),
  ('7a2deafa-071a-4039-b0d1-82b811bb9340'::uuid, '/food-images/7a2deafa-071a-4039-b0d1-82b811bb9340.webp', '29d0ddcaf07a754a686fa28fbbd3d9d4f02907fff69575eca12b90cf3d568bd0'),
  ('43ca6e97-837e-4658-a9aa-b5b8a778f3bb'::uuid, '/food-images/43ca6e97-837e-4658-a9aa-b5b8a778f3bb.webp', '0c6cc8bf8fac0503d80ad37559443ffc217acee16dff29dd6774498f0d11a444'),
  ('10302a1d-fafe-4afe-878a-d12463249ef6'::uuid, '/food-images/10302a1d-fafe-4afe-878a-d12463249ef6.webp', '2dbc2bb5f9d05a1139269d8b4e4937d7018165cbdeb21a6e9b259af54bd79825'),
  ('2bf941c0-d057-47f4-8e63-5edba6c343ac'::uuid, '/food-images/2bf941c0-d057-47f4-8e63-5edba6c343ac.webp', 'f15ce58406cc53992e011bb94c1ef6e5069ccf61aa404a4a65e8f1d2d404aec5'),
  ('e5760aaf-ccf0-4b88-8642-7188ffe52afd'::uuid, '/food-images/e5760aaf-ccf0-4b88-8642-7188ffe52afd.webp', 'b578dda88ca4a7514a6adacd30affddbe27ed2715b47be0b77e47eb9c2add447'),
  ('3e71a1db-82eb-40b2-8ed8-fb0e96ff7c1f'::uuid, '/food-images/3e71a1db-82eb-40b2-8ed8-fb0e96ff7c1f.webp', 'e8127f6431056b199bb15e54637f558429eb8136e4b6b29cc580f50e7b6ef7fa'),
  ('bc20c7c2-8eb7-4961-9f8a-358951ce10b1'::uuid, '/food-images/bc20c7c2-8eb7-4961-9f8a-358951ce10b1.webp', 'e25e2dbec562bfbff1695eabb209c4ee9f8548bbd558c40e46eb4e00ffcbc916'),
  ('e8acbfec-0d3d-4c4d-a1e7-65dd0817166a'::uuid, '/food-images/e8acbfec-0d3d-4c4d-a1e7-65dd0817166a.webp', '9782f7b35c52a62a8f05ef4fdfcad1f14a0f4cf0b6af2c8b4f9a606750911fd1'),
  ('b25abcb2-4448-4f4b-aafb-e29de097a108'::uuid, '/food-images/b25abcb2-4448-4f4b-aafb-e29de097a108.webp', 'd93353ebc6f4ec6e3325db5694112a57d3d17208caf01d7e790539f05b93819f'),
  ('4429d1e1-8362-42a6-8bf2-46744f0c1974'::uuid, '/food-images/4429d1e1-8362-42a6-8bf2-46744f0c1974.webp', '37e0d067b63022e380bb1e2615295250d8b0f02a3a1fdf14f0c82f8a26a04bfd'),
  ('4d91dfbb-86e4-41fb-a919-a131488e2ee7'::uuid, '/food-images/4d91dfbb-86e4-41fb-a919-a131488e2ee7.webp', '7ee3c80730e9c9ad94166df5d37bac483998c7c378645737767335959544c586'),
  ('30bb8430-126a-4405-b6b0-2b73f28deb00'::uuid, '/food-images/30bb8430-126a-4405-b6b0-2b73f28deb00.webp', '950a8663e7112f1ac03ffd9900523dde2435801c3979de773a24cfd0083fcde8'),
  ('17a2ea12-979d-4170-af0d-e1f4d5234c4e'::uuid, '/food-images/17a2ea12-979d-4170-af0d-e1f4d5234c4e.webp', '990e22f55ccb553887d52141f83671e46cd9e4516794f71e6f27f24f42644eaf'),
  ('beca50ef-607f-4053-b5a0-df50d2518914'::uuid, '/food-images/beca50ef-607f-4053-b5a0-df50d2518914.webp', '9fe0f37734a80a6dded3a6bb778679540e8bb16c2bfbb8af6d47afcf5951e693'),
  ('85c09d72-e5d8-467e-b358-8033f3de0787'::uuid, '/food-images/85c09d72-e5d8-467e-b358-8033f3de0787.webp', '1d1cb49f911eff72ee90ce39987fbb7b06d72de811fbb294952b520a52f329d1'),
  ('77b49ca4-82b3-47fd-9dac-e728988e90cf'::uuid, '/food-images/77b49ca4-82b3-47fd-9dac-e728988e90cf.webp', '3bc4a8dd48c93aa60e8313af973afa7337f5f6d3a86f61d47d570645d6d38875'),
  ('3f621ba1-f487-490e-928e-923b6204b599'::uuid, '/food-images/3f621ba1-f487-490e-928e-923b6204b599.webp', '7182ea3180fdd733f19b9842dfa87f46ac363fb110a6afb99272c4b756a48fc5'),
  ('48e55431-b38f-459b-9d85-06a789734fcb'::uuid, '/food-images/48e55431-b38f-459b-9d85-06a789734fcb.webp', '1677a17f6d8ec08361415b41f7252c4c11ef9e8c0ec0f955089b1bf72537b549'),
  ('c66eacb0-e87e-420a-9f7b-1e4e54d06b2e'::uuid, '/food-images/c66eacb0-e87e-420a-9f7b-1e4e54d06b2e.webp', 'fa3f02d3bce37b5699c7a2f5b0e14edb3bc593a825d4a2054d2ea2fb898adb43'),
  ('8db70bef-4cf7-4d36-82e3-335d11eab0a2'::uuid, '/food-images/8db70bef-4cf7-4d36-82e3-335d11eab0a2.webp', '6202799336a9a07e7bfe425b53d0e035d3abd0e0cb142c80476d1ef8d4124dc6'),
  ('2b13e5b8-8ae3-4348-b895-5dcefe12470d'::uuid, '/food-images/2b13e5b8-8ae3-4348-b895-5dcefe12470d.webp', '65a091ad0eb1fcc54e039f63d015baa512eecdcb64a3829e2b31ca70886d5cc9'),
  ('8658eab1-e449-480f-a217-c1dd1a9e8de0'::uuid, '/food-images/8658eab1-e449-480f-a217-c1dd1a9e8de0.webp', '3b9e342e54b85afcdaebc1105ff79b600001bf6ee1ad84e2fcf07c7513043daf'),
  ('31df72e4-d8d1-41df-a6bd-b34467d61428'::uuid, '/food-images/31df72e4-d8d1-41df-a6bd-b34467d61428.webp', '5d848819ff9732edb00a5d6be9ae2ff053f0c409deba451a7ff4fd9174b93c0f'),
  ('e4fb3791-a20f-4c43-af91-8079bcb14278'::uuid, '/food-images/e4fb3791-a20f-4c43-af91-8079bcb14278.webp', '07d09f97736172606a011f5d596da3a99f2a0af3e799c82d8306bfb8a931698f'),
  ('7a692fa2-defb-42da-9e94-1228c0a01eaa'::uuid, '/food-images/7a692fa2-defb-42da-9e94-1228c0a01eaa.webp', 'f59ed0ef0ae8294585a451f3a3dcc394a018e855a5990b537fe4fcb4c9a4d4b6'),
  ('7195afb0-984f-47ca-854c-bfe91689e47a'::uuid, '/food-images/7195afb0-984f-47ca-854c-bfe91689e47a.webp', '2114a4e9147188ce4b5e092cb2985d960ba0882c938ab02fd1c7dbd27e48bcba'),
  ('f9595e20-2fcd-47a4-8d7f-c9dc7a4b8c1e'::uuid, '/food-images/f9595e20-2fcd-47a4-8d7f-c9dc7a4b8c1e.webp', '914557c2b9987c0fc65071ef7ba6c8365356647aa2256b7706cbad272782383e'),
  ('649f41d5-5cfc-4a53-82b1-e4d17f5a9037'::uuid, '/food-images/649f41d5-5cfc-4a53-82b1-e4d17f5a9037.webp', 'e7097c7313874507458fbe884a7bcc70bf5682afaf8fd2eb67d805938a993c82'),
  ('3058db77-e343-4955-b59d-d9a5413766a6'::uuid, '/food-images/3058db77-e343-4955-b59d-d9a5413766a6.webp', '5ad876f191d4f3a5a2ab6bfbc7c569767c748131a87323dc94576b0afc782fcd'),
  ('db2b56ba-2d87-486a-978d-64f7226d5823'::uuid, '/food-images/db2b56ba-2d87-486a-978d-64f7226d5823.webp', 'd6890663d0fb695d7006996c109277732a2164841c2e429c52e6c4d5aa7db002'),
  ('f704afb2-3593-47f0-a04b-02ce53dda7e6'::uuid, '/food-images/f704afb2-3593-47f0-a04b-02ce53dda7e6.webp', '6f3d35a5a48195852eb61a48016b078c8110c3eba24aeb48cd5e2ff9e3a780da'),
  ('6cd18615-ff65-487f-b8b3-05f5113fe2b2'::uuid, '/food-images/6cd18615-ff65-487f-b8b3-05f5113fe2b2.webp', 'e799f6eeefb6845d0663bab10e2535fcc57016d31387699f02ab9a17bf3f114a'),
  ('d690683d-0ff4-41c8-82b9-209a8126419c'::uuid, '/food-images/d690683d-0ff4-41c8-82b9-209a8126419c.webp', '037d4bc607c9f520d774d1167ac75b7a8e529a95682d046aabf0a5f318941a42'),
  ('a8de328f-864b-4b4e-a688-0ee7e38cb1a9'::uuid, '/food-images/a8de328f-864b-4b4e-a688-0ee7e38cb1a9.webp', 'd387750aabfc02a4cff23e92e92ccc75025cf6a6491ed0c4dcf01ba1b5fad3a2'),
  ('85c8a09f-e111-4d9d-b774-208b46c8636c'::uuid, '/food-images/85c8a09f-e111-4d9d-b774-208b46c8636c.webp', 'a6185c53a29639091cdaa848e5bb154ea304d7336b36ac1269045b16b60fa577'),
  ('dbdd8221-bad3-4666-8e1b-21d0cb74a882'::uuid, '/food-images/dbdd8221-bad3-4666-8e1b-21d0cb74a882.webp', '4ac6d3e124e666a7e22eec7d6c75f49a2c740cbc69bd9cbad4b5fd98e90e643a'),
  ('d5dcf5a4-937f-401c-a84d-fc320a46f2dc'::uuid, '/food-images/d5dcf5a4-937f-401c-a84d-fc320a46f2dc.webp', '3dda984a80aab28c6107abb2cb54e9db45e99a6e9a7ef450eaf1bcad0c132c42'),
  ('e885d89b-a35a-46be-b423-297166118dbb'::uuid, '/food-images/e885d89b-a35a-46be-b423-297166118dbb.webp', 'f6ef3ab3697b829cbe5fd3e46bfcd7479ed3b92c4444198eded6ac7214e33c8b'),
  ('28139900-93b1-4f63-8299-4a24e744ea75'::uuid, '/food-images/28139900-93b1-4f63-8299-4a24e744ea75.webp', '1d56f7854cb407f1649046f2f7a9015b2b6c0cbe9eddeb7ec8f1cc43b80bcc65'),
  ('3f927874-84ba-4dd9-afde-b9c7738ed30c'::uuid, '/food-images/3f927874-84ba-4dd9-afde-b9c7738ed30c.webp', '8c89eaad4c579bc1650be6704153d223286b9e8f6708a9b960b23fcfb5f4658f'),
  ('cc5287d3-07e1-4b76-ad2f-ff27ab9938f9'::uuid, '/food-images/cc5287d3-07e1-4b76-ad2f-ff27ab9938f9.webp', 'fd86b5cf0d2821347da20cce46466b28557858fac3bc5b919049ab8aceff9c8f'),
  ('54796f5a-7e5b-4984-a5d8-293f96ad83aa'::uuid, '/food-images/54796f5a-7e5b-4984-a5d8-293f96ad83aa.webp', '6d523de59bb85609c82ad2df381fe8d8787ce8d7c4cf1382aca4c85a659b01a7'),
  ('9e6ab617-87fc-413f-b024-a705df6f1d22'::uuid, '/food-images/9e6ab617-87fc-413f-b024-a705df6f1d22.webp', '569231a1187a94f35be4d15cb79b5b2492a376d8338548741fc1da872017f546'),
  ('4906cdc9-fe9a-4d81-90bc-81489e348996'::uuid, '/food-images/4906cdc9-fe9a-4d81-90bc-81489e348996.webp', 'b19882c7a844b21a3c3ffd483db9a18bc67e984d933caafd5bcca97f29f68735'),
  ('71951dfe-2848-41aa-8fac-a60f4c503dc8'::uuid, '/food-images/71951dfe-2848-41aa-8fac-a60f4c503dc8.webp', '2f24ef19359219f661fca05a7cfce9c8c10e3f709180d8c3f26af5a848685469'),
  ('88e91c28-ccfd-4f0e-82ff-a87ec3cf6d73'::uuid, '/food-images/88e91c28-ccfd-4f0e-82ff-a87ec3cf6d73.webp', '4e4612bacb7125ae958ce0074153e499b1d45802563167a42a80e5473dc22bdc'),
  ('e8b271b5-837e-4c28-8594-90ddf290e5ec'::uuid, '/food-images/e8b271b5-837e-4c28-8594-90ddf290e5ec.webp', 'a757d2425510de0f9bd20643dc34d9c23bc2ee83a760682c0cd22f5294405f31'),
  ('fdd52b27-1d99-421b-887e-0899af9d3774'::uuid, '/food-images/fdd52b27-1d99-421b-887e-0899af9d3774.webp', '45d8a2c274748a5909d24e87f1a139d44877601b5bd869c164de5382459e0912'),
  ('938a9106-7427-477a-a77e-e0e9f1611826'::uuid, '/food-images/938a9106-7427-477a-a77e-e0e9f1611826.webp', 'aa5bf22861fbcccf3e61c1d14ae001ab9c895f124c528478114161356b98d5fe'),
  ('88640363-3c8c-42a8-9789-975c32bbeacd'::uuid, '/food-images/88640363-3c8c-42a8-9789-975c32bbeacd.webp', '74e33638ec19fb2bf1a52e4cc252da15575da2eca4bc158e39ab9844ea69c8e3'),
  ('55435532-b058-4fc9-9441-501691cb02df'::uuid, '/food-images/55435532-b058-4fc9-9441-501691cb02df.webp', 'fa5a28b0aa1eae31a2f621a5a35a3e1517de4ee14633155ee9284812ea75c1da'),
  ('e7077c7c-cb66-4489-8eef-ab2331a16c93'::uuid, '/food-images/e7077c7c-cb66-4489-8eef-ab2331a16c93.webp', '3b6d454b28bad4a83c526b56e72ba1835a500c32e320e9f3d48751af5e85f6c4'),
  ('bead22e4-00ed-430a-829d-471600f2bc71'::uuid, '/food-images/bead22e4-00ed-430a-829d-471600f2bc71.webp', 'cfebd5a60d18f507ff67f4521a2d08a45ea1e0c81ee1d825ded09ec7dd9d2a4e'),
  ('3202d56c-ffe8-4286-ae33-af0220e8c7a8'::uuid, '/food-images/3202d56c-ffe8-4286-ae33-af0220e8c7a8.webp', '9ad6c9a4bdc658f1a5ad18e9907d80a54e748e3b81f37a0df5cca2cb688c6d2a'),
  ('d851ba72-4002-4d2e-a8a6-8099762cc6ca'::uuid, '/food-images/d851ba72-4002-4d2e-a8a6-8099762cc6ca.webp', 'caac1b4d3c97cdfe72b6cc3bb3b90287a568427efb6c68febb34f59953ab8b5f'),
  ('7fe5f7b2-8e49-461c-9067-563c1fba5e3f'::uuid, '/food-images/7fe5f7b2-8e49-461c-9067-563c1fba5e3f.webp', '185a7e599f75f824ee26741ab2ee784c1fb3c8dd9568834715c6b389cb152e4c'),
  ('c15f6947-f872-4ef3-889a-88ad4c6ba92e'::uuid, '/food-images/c15f6947-f872-4ef3-889a-88ad4c6ba92e.webp', '35426c6621c896904efdd07dcfd66477bc3c3dc9c3ebac676dd0a753d71ba8e2'),
  ('62581ebc-a64e-4161-a8da-b61bca5d9f59'::uuid, '/food-images/62581ebc-a64e-4161-a8da-b61bca5d9f59.webp', '1ae0f66b18e5553c3eea1a6d9de99982526af997f8aff5a8f0719c432ff67108'),
  ('35398842-78f7-4671-9078-d37ab36c3441'::uuid, '/food-images/35398842-78f7-4671-9078-d37ab36c3441.webp', 'd8ba04c88423d506bc1e2d64c9576bb6d0db7da124817ad7119891b29c065eab'),
  ('dabea064-a09c-4e26-8e81-a9eac9457607'::uuid, '/food-images/dabea064-a09c-4e26-8e81-a9eac9457607.webp', '8d8a6de57ef4563e4594a13dd8bee5ddbd13cc1c4feffd840c6c586e9467b40f'),
  ('2fe801b6-1935-4e33-b1ee-d3e1f49ab5f5'::uuid, '/food-images/2fe801b6-1935-4e33-b1ee-d3e1f49ab5f5.webp', '8c269444f91b0ba0cb35c38ce93e1b848226c8f367025b2ff6790048630b5004'),
  ('df7c9688-37a3-492e-92aa-c766293262a0'::uuid, '/food-images/df7c9688-37a3-492e-92aa-c766293262a0.webp', '3a049721cc0e716df8f023e86a37d5e3f25808458e8ee6a208a0948e64eaf837'),
  ('0326e4ff-2038-4b84-8721-d7050bc8f4a9'::uuid, '/food-images/0326e4ff-2038-4b84-8721-d7050bc8f4a9.webp', 'a133434895b8700781704a826f81cf661898893116aafce48e8a319a5dc5845a'),
  ('3172fda0-bb0b-4e8d-ac0f-d018aff6a727'::uuid, '/food-images/3172fda0-bb0b-4e8d-ac0f-d018aff6a727.webp', '70de013355a93541d29d55a17d8bc07ceeead21f419b082a8052139bfb0aed39'),
  ('28707dbc-d8ec-4fd3-8b10-c641ef1ddad5'::uuid, '/food-images/28707dbc-d8ec-4fd3-8b10-c641ef1ddad5.webp', '685613ab326c540ccb74aac410f487ee3c9944c3f2d2fe0773e174f33ba91bb4'),
  ('69bd6992-af9e-4473-b4f1-93fe5d4e88a1'::uuid, '/food-images/69bd6992-af9e-4473-b4f1-93fe5d4e88a1.webp', 'a00c7f5d058327d44924296ae27e63f95bc173d973ed196ad153ff18dcd5ecd4'),
  ('9d196ba7-af91-4dd2-a37f-483f8e042d07'::uuid, '/food-images/9d196ba7-af91-4dd2-a37f-483f8e042d07.webp', '9e634fd9ff8a9347feac7db8e09b5a485062395b7bdb8d488d28bd32e64e6c62'),
  ('7a642b78-2141-4928-a46f-311a1550ebe0'::uuid, '/food-images/7a642b78-2141-4928-a46f-311a1550ebe0.webp', '486965f909888454308ee49b0e8dd4358ae9aba0509db6c6400983cce362298d'),
  ('4bd05f00-0a39-49dc-a71c-a0580275436d'::uuid, '/food-images/4bd05f00-0a39-49dc-a71c-a0580275436d.webp', '297d5e9ba530f1c72ef4925fd0136ebe0afe2fa9991575c4e33c6619f1e46a29'),
  ('ca59c78b-615e-46c8-8e35-819a0e7480cc'::uuid, '/food-images/ca59c78b-615e-46c8-8e35-819a0e7480cc.webp', '86feca6852d290f6e76ae1bf09ab394cc9a96b92bd8ae2d29e8f7c14e1f3d962'),
  ('2db219c2-aa16-470f-b936-175a9fe449e0'::uuid, '/food-images/2db219c2-aa16-470f-b936-175a9fe449e0.webp', '989e113818485570f11a5f5dcc406fae391220154b8424ce8ff0eebaaa962ea4'),
  ('40458961-7748-4bfc-8f6c-641df9c44673'::uuid, '/food-images/40458961-7748-4bfc-8f6c-641df9c44673.webp', '6e2c2fa09b479f41de59ea60e48361556426da644af7433f03b554d99fad50b9'),
  ('0a78df04-03fb-4b00-8eb0-e00f86212a16'::uuid, '/food-images/0a78df04-03fb-4b00-8eb0-e00f86212a16.webp', 'ef82dea454f138b5c27233e16d5bf7b0e08ba9e36d35bdb72b21f3e71c2bd6b6'),
  ('a54a194a-d81b-4214-bb35-ac356bc6bb1a'::uuid, '/food-images/a54a194a-d81b-4214-bb35-ac356bc6bb1a.webp', 'ca18a5dba57cb6e6c6c74a1eed69477eea9f1e51ff1fc89d6f34d558dceba74f'),
  ('fad3e74f-f75d-4031-9a16-1b685646b3f5'::uuid, '/food-images/fad3e74f-f75d-4031-9a16-1b685646b3f5.webp', '7bf2063644e7aace1216b9bd3badb7688ff65fc488287b92ea1a7903d4d92bab'),
  ('86a18812-a15d-4b22-9c09-2c2d041a5e41'::uuid, '/food-images/86a18812-a15d-4b22-9c09-2c2d041a5e41.webp', 'b140d65640c114c6b25bb9947d0be909e3b72d2220613f631a1dcfc9b27ffad8'),
  ('345cbd8d-0778-44e8-9f5c-0a71e3c6fbd6'::uuid, '/food-images/345cbd8d-0778-44e8-9f5c-0a71e3c6fbd6.webp', 'c3771bfb6b127ea798e5f82d4c76bc7dcfb5775ce3a93a45edb8cd414c07994a'),
  ('29041199-7ab7-4133-9748-462d9e88a07d'::uuid, '/food-images/29041199-7ab7-4133-9748-462d9e88a07d.webp', '33310923c294ad58be274e39980f926d75305e6b5289f44794acefed0f685abd'),
  ('b265087d-f53d-4f2c-b303-a7485c4d047c'::uuid, '/food-images/b265087d-f53d-4f2c-b303-a7485c4d047c.webp', '87e8e70d9bd1d9ba0b594091fa6f370d535de8ee17f992af7b86247a70c38429'),
  ('df6b28ff-c283-4b81-b793-955efc387c1e'::uuid, '/food-images/df6b28ff-c283-4b81-b793-955efc387c1e.webp', 'af5deb774251d4d3e2e9f87d2386ac3cc285d2e8b07f6c910183c5385f0e0c2f'),
  ('213b489a-43a0-421d-99df-e010f065bb54'::uuid, '/food-images/213b489a-43a0-421d-99df-e010f065bb54.webp', 'a6dcc25e3a40d8e382894b858c36232e5831ba1e2413846d08db2fcffb8f71df'),
  ('d4cac174-7282-4faf-85a6-526b5d728db4'::uuid, '/food-images/d4cac174-7282-4faf-85a6-526b5d728db4.webp', 'f695abb13d6bc4c64e7912099f01838eb0499191b0f24262f4be347a82f8f238'),
  ('a21653e8-d4ac-4bc8-a7d1-ed9858c99633'::uuid, '/food-images/a21653e8-d4ac-4bc8-a7d1-ed9858c99633.webp', '0243b4e2ea13e5e456b41ea81479c805da7282bdbd2024f44459f86e1dac9b99'),
  ('f64dfc41-118b-4332-94f5-e4b1271537cc'::uuid, '/food-images/f64dfc41-118b-4332-94f5-e4b1271537cc.webp', '781a1d2bbbd8a294d5e5a76a5e54cf313eac31ae53327d8d1408ff5432859787'),
  ('49e68f88-0fd8-40bc-89b7-5d932d068f56'::uuid, '/food-images/49e68f88-0fd8-40bc-89b7-5d932d068f56.webp', 'e3c48d0fe469279e3209cfabfdef9637ca73c3465a7490944d7a6b1bbf6da209'),
  ('194c95cb-4095-459d-8661-f2d82b6080cc'::uuid, '/food-images/194c95cb-4095-459d-8661-f2d82b6080cc.webp', '372b548671c51ca1ca8bd5256a6ee95622ae0c459cfe7159390e7e326bd8fc67'),
  ('b7014056-77ff-411e-931a-b9acbd7d7c33'::uuid, '/food-images/b7014056-77ff-411e-931a-b9acbd7d7c33.webp', '226cc30f0f37c98c36e96731f26d9e2ce4b91e9b48218088107de6400681e6ec'),
  ('4cd93ae8-a072-4c58-a81f-1b437c89c85b'::uuid, '/food-images/4cd93ae8-a072-4c58-a81f-1b437c89c85b.webp', '1fce6c5bb4018f91b0847afca32db802ec6f474758fb04485e7dd0a23f550cce'),
  ('4a4db01c-a42f-406c-8e70-043076b67bdc'::uuid, '/food-images/4a4db01c-a42f-406c-8e70-043076b67bdc.webp', '659fdf13aff655a1ccb39ac7d2c2ad51037ee3928df71517f05b01e71d9f2e5c'),
  ('7dae9d70-324f-491d-bea4-191c21d676b0'::uuid, '/food-images/7dae9d70-324f-491d-bea4-191c21d676b0.webp', '23c61e794c400357d8b3c6d46554852417f48f24e5b6377424a5f40acbe3eff0'),
  ('8bbb7454-1718-4090-93d8-dcb37cc8e485'::uuid, '/food-images/8bbb7454-1718-4090-93d8-dcb37cc8e485.webp', '566dc2d7b55f7bad024037b1d83a02a29e1eb13823c9c2fd7c0a7b4dfe28d349'),
  ('41075653-64ac-4529-9292-8858668024e4'::uuid, '/food-images/41075653-64ac-4529-9292-8858668024e4.webp', 'd770db8be1b5acd1f2c7472b38db57a3077d7d005be5376f78121602260e13dc'),
  ('0c739dfd-7e85-466f-8648-c703eaed9ba2'::uuid, '/food-images/0c739dfd-7e85-466f-8648-c703eaed9ba2.webp', 'bd4923bc42e656c2dc876d6969ca8ad21cf25edeb0da0be59be2c7e4eb6223f9'),
  ('6efc9824-7605-43cb-b816-e4479ea5b605'::uuid, '/food-images/6efc9824-7605-43cb-b816-e4479ea5b605.webp', '85867820c5eff9e808b9a7f6527b1bfbe65f9000c79c840e839a6dc162eebb12'),
  ('9c0e64db-a6e8-4d32-abb2-fad44bb4f5d4'::uuid, '/food-images/9c0e64db-a6e8-4d32-abb2-fad44bb4f5d4.webp', 'f3123aa1c0749f4efb1e8328b43605c9228d9e8eff3f7bfd360e5083f805935a'),
  ('39254808-c4bc-4649-84d6-ee4289fe43a8'::uuid, '/food-images/39254808-c4bc-4649-84d6-ee4289fe43a8.webp', '5e557d33ae44a6ffdd080eab8980cea84cc846b4ac72f2c87ce30ec4c03a10e8'),
  ('0d8fae7d-951a-44f6-a7ec-42698ad74cb6'::uuid, '/food-images/0d8fae7d-951a-44f6-a7ec-42698ad74cb6.webp', 'e32c597885945f82460ab6373d95fbd341d27b2d1ca6b9d196786562429ac33f'),
  ('1a6794b5-6efa-4a0a-a1c2-34a7a6dbb1fc'::uuid, '/food-images/1a6794b5-6efa-4a0a-a1c2-34a7a6dbb1fc.webp', '6b26ebd54f68befc3e3c0ba1a924a7ab65a10bbd89a96400954d55097e512c2e'),
  ('bc57c2fc-6dc1-4003-bfb5-fcaf86c30f25'::uuid, '/food-images/bc57c2fc-6dc1-4003-bfb5-fcaf86c30f25.webp', 'c4e5c99e0672cc52fe5770a25eaee8cdb5a268531618527ab158080f28fe8025');

do $$
declare
  expected_count integer := 139;
  active_count integer;
begin
  select count(*) into active_count
  from public.food_items as food
  join wolf_kaafe_photo_assignments as photo on photo.id = food.id
  where food.is_active is true;

  if active_count <> expected_count then
    raise exception 'Expected all 139 photo target items to remain active; found %', active_count;
  end if;
end $$;

update public.food_items as food
set image_url = photo.image_url,
    image_sha256 = photo.image_sha256,
    updated_at = now()
from wolf_kaafe_photo_assignments as photo
where food.id = photo.id
  and food.is_active is true;

do $$
declare
  expected_count integer := 139;
  applied_count integer;
begin
  select count(*) into applied_count
  from public.food_items as food
  join wolf_kaafe_photo_assignments as photo on photo.id = food.id
  where food.is_active is true
    and food.image_url = photo.image_url
    and food.image_sha256 = photo.image_sha256;

  if applied_count <> expected_count then
    raise exception 'Photo update incomplete: expected %, found %', expected_count, applied_count;
  end if;
end $$;

commit;
