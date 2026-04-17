import { PartialType } from '@nestjs/mapped-types';
import { CreateRivalTargetDto } from './create-target.dto';

export class UpdateRivalTargetDto extends PartialType(CreateRivalTargetDto) {}
