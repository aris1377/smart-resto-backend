import { PartialType } from '@nestjs/swagger';
import { CreateTableDto } from './create-table.dto';

// hallId ham o'zgartirilishi mumkin — stolni boshqa zalga ko'chirish
// hayotiy amal, lekin faqat o'sha filial ichida (service tekshiradi)
export class UpdateTableDto extends PartialType(CreateTableDto) {}
